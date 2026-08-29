/**
 * randomService.js — Random Connect mode
 *
 * Serverless random matching + P2P chat/voice/video built on Trystero
 * (https://trystero.dev) using the BitTorrent strategy for signaling.
 *
 * How random matching works:
 *  - Every available user joins one of a small set of "lobby" rooms (shards).
 *    Each shard hosts MANY independent 1:1 pairs. Peers within a shard are
 *    randomly wired to each other via Trystero's handshake admission:
 *    `onPeerHandshake` accepts the first peer and denies everyone else, so a
 *    user is matched with exactly one other online user at a time.
 *  - Pressing "Next" leaves the current room and joins a fresh shard, which
 *    yields a new random match.
 *  - Conversations are NOT persisted anywhere — messages live only in memory
 *    for the duration of the session.
 *
 * This service is deliberately isolated from nostrService (private chats):
 * identity, signaling, transport, and persistence never overlap.
 */

import { joinRoom } from '@trystero-p2p/torrent';

// Unique app namespace so we never collide with other apps on the trackers.
const APP_ID = 'airchat-random-connect-v1';

// Multiple lobby shards keep independent matches separate without everyone
// landing in the same room. Each shard can hold many 1:1 pairs.
const SHARD_COUNT = 5;

// Public WebSocket BitTorrent trackers — used ONLY for the random-mode
// signaling handshake. Chat/call data flows over direct WebRTC afterwards.
const TRACKERS = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
  'wss://open.ftorrent.com',
  'wss://tracker.btorrent.xyz',
];

const MATCH_TIMEOUT_MS = 20000; // no match within this window → try a new shard
const REMATCH_DELAY_MS = 900; // brief pause before rematching after peer leaves

class RandomService {
  constructor() {
    this.room = null;
    this.shardIndex = null;
    this.matchedPeerId = null;
    this.myName = null;

    this.localStream = null;
    this.matchTimer = null;
    this.rematchTimer = null;
    this.running = false;
    this.destroyed = true;
    this.session = 0; // guard against stale room callbacks after leave()

    this.handlers = {
      onPhase: null, // 'idle' | 'searching' | 'matched'
      onMessage: null, // {id, text, timestamp} from matched peer
      onTyping: null, // boolean
      onPeerInfo: null, // ({peerId, name})
      onCallState: null, // {type, mode, ...}
      onLocalStream: null, // MediaStream | null
      onRemoteStream: null, // MediaStream
      onError: null, // string
    };
  }

  setHandlers(h) {
    this.handlers = { ...this.handlers, ...h };
  }

  // ─── Public API (called by RandomConnectProvider) ────────────────────────

  start(myProfile) {
    if (this.running) return;
    this.running = true;
    this.destroyed = false;
    this.myName = myProfile?.name || myProfile?.username || null;
    this._joinShard(this._pickShard(null));
  }

  /** User pressed "Next" — end call, drop this peer, find another. */
  next() {
    if (!this.running) return;
    this._hangupLocal('next');
    this._leaveRoom();
    this._joinShard(this._pickShard(this.shardIndex));
  }

  /** User left Random Connect entirely. */
  leave() {
    if (!this.running) return;
    this.running = false;
    this.destroyed = true;
    this.session++; // invalidate any in-flight callbacks from lingering rooms
    this._hangupLocal('leave');
    this._leaveRoom();
    this.handlers.onPhase?.('idle');
  }

  sendMessage(text) {
    const peerId = this.matchedPeerId;
    if (!peerId || !this.room) return false;
    const msg = { id: crypto.randomUUID(), text, timestamp: Date.now() };
    this.chatAction?.send(msg, { target: peerId });
    return true;
  }

  sendTyping(isTyping) {
    const peerId = this.matchedPeerId;
    if (peerId && this.room) this.typingAction?.send({ isTyping }, { target: peerId });
  }

  async requestCall(mode) {
    if (!this.matchedPeerId) return;
    try {
      const stream = await this._ensureMedia(mode);
      this._setLocalStream(stream);
    } catch {
      this.handlers.onError?.('Could not access camera/microphone.');
      return;
    }
    this.callAction?.send({ type: 'invite', mode }, { target: this.matchedPeerId });
    this.handlers.onCallState?.({ type: 'ringing', mode });
  }

  async acceptCall(mode) {
    if (!this.matchedPeerId) return;
    let stream;
    try {
      stream = await this._ensureMedia(mode);
      this._setLocalStream(stream);
      this.room?.addStream(stream, { target: this.matchedPeerId });
    } catch {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        this.localStream = null;
        this.handlers.onLocalStream?.(null);
      }
      this.declineCall();
      this.handlers.onError?.('Could not access camera/microphone.');
      return;
    }
    this.callAction?.send({ type: 'accept', mode }, { target: this.matchedPeerId });
    this.handlers.onCallState?.({ type: 'active', mode });
  }

  declineCall() {
    if (this.matchedPeerId) this.callAction?.send({ type: 'decline' }, { target: this.matchedPeerId });
    this.handlers.onCallState?.({ type: 'ended', reason: 'declined' });
  }

  endCall() {
    this._hangupLocal('end');
    this.handlers.onCallState?.({ type: 'ended', reason: 'local' });
  }

  toggleMic() {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  toggleCam() {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  // ─── Matching internals ──────────────────────────────────────────────────

  _shardId(index) {
    return `airchat-random-shard-${index}`;
  }

  _pickShard(exclude) {
    if (exclude === null) return Math.floor(Math.random() * SHARD_COUNT);
    let idx;
    do {
      idx = Math.floor(Math.random() * SHARD_COUNT);
    } while (idx === exclude);
    return idx;
  }

  _joinShard(index) {
    if (this.destroyed) return;
    this.shardIndex = index;
    const seq = ++this.session;
    this.handlers.onPhase?.('searching');

    try {
      this.room = this._createRoom(this._shardId(index), seq);
    } catch {
      this.handlers.onError?.('Could not join random room — retrying…');
    }

    // Give up on this shard and spin to another if nobody shows up.
    this._clearTimer('matchTimer');
    this.matchTimer = setTimeout(() => {
      if (this.destroyed || this.matchedPeerId) return;
      this._leaveRoom(seq);
      this._joinShard(this._pickShard(this.shardIndex));
    }, MATCH_TIMEOUT_MS);
  }

  _createRoom(roomId, seq) {
    const room = joinRoom(
      {
        appId: APP_ID,
        relayConfig: { urls: TRACKERS },
      },
      roomId,
      {
        handshakeTimeoutMs: 15000,
        onJoinError: (d) => {
          if (seq !== this.session) return;
          this.handlers.onError?.(d?.error || 'Connection failed — retrying…');
        },
        // Admission control: accept the first peer, deny everyone else.
        // This is what produces randomized 1:1 matches inside the shard.
        onPeerHandshake: async (peerId) => {
          if (seq !== this.session) throw new Error('stale');
          if (this.matchedPeerId && this.matchedPeerId !== peerId) {
            throw new Error('busy');
          }
        },
      }
    );

    room.onPeerJoin = (peerId) => {
      if (seq !== this.session) return;
      this._clearTimer('matchTimer');
      this.matchedPeerId = peerId;
      this.handlers.onPeerInfo?.({ peerId, name: null });
      this.handlers.onPhase?.('matched');
      this.helloAction?.send({ name: this.myName ?? 'Stranger' }, { target: peerId });
    };

    room.onPeerLeave = (peerId) => {
      if (seq !== this.session) return;
      if (peerId === this.matchedPeerId) {
        this._hangupLocal('peer-left');
        this.matchedPeerId = null;
        this.handlers.onPhase?.('searching');
        this._clearTimer('rematchTimer');
        this.rematchTimer = setTimeout(() => {
          if (this.destroyed || this.matchedPeerId) return;
          this._leaveRoom(seq);
          this._joinShard(this._pickShard(this.shardIndex));
        }, REMATCH_DELAY_MS);
      }
    };

    room.onPeerStream = (stream, peerId) => {
      if (seq !== this.session) return;
      if (peerId === this.matchedPeerId) this.handlers.onRemoteStream?.(stream);
    };

    // 1:1 chat/typing/call channels — targeted to the matched peer.
    const helloAction = room.makeAction('hello');
    helloAction.onMessage = ({ name }, { peerId }) => {
      if (seq !== this.session || peerId !== this.matchedPeerId) return;
      this.handlers.onPeerInfo?.({ peerId, name: name || 'Stranger' });
    };

    const chatAction = room.makeAction('chat');
    chatAction.onMessage = (msg, { peerId }) => {
      if (seq !== this.session || peerId !== this.matchedPeerId) return;
      this.handlers.onMessage?.({
        id: msg?.id || crypto.randomUUID(),
        text: msg?.text ?? '',
        timestamp: msg?.timestamp || Date.now(),
      });
    };

    const typingAction = room.makeAction('typing');
    typingAction.onMessage = (data, { peerId }) => {
      if (seq !== this.session || peerId !== this.matchedPeerId) return;
      this.handlers.onTyping?.(Boolean(data?.isTyping));
    };

    const callAction = room.makeAction('call');
    callAction.onMessage = (data, { peerId }) => {
      if (seq !== this.session || peerId !== this.matchedPeerId) return;
      switch (data?.type) {
        case 'invite':
          this.handlers.onCallState?.({ type: 'incoming', mode: data.mode });
          break;
        case 'accept': {
          // Inviter starts sending their stream once the responder picks up.
          const stream = this.localStream;
          if (stream && this.room) this.room.addStream(stream, { target: peerId });
          this.handlers.onCallState?.({ type: 'active', mode: data.mode });
          break;
        }
        case 'decline':
          this._stopLocalMedia();
          this.handlers.onCallState?.({ type: 'ended', reason: 'declined' });
          break;
        case 'end':
          this._stopLocalMedia();
          this.handlers.onCallState?.({ type: 'ended', reason: 'remote' });
          break;
      }
    };

    this.helloAction = helloAction;
    this.chatAction = chatAction;
    this.typingAction = typingAction;
    this.callAction = callAction;

    return room;
  }

  _leaveRoom(seqFilter) {
    if (seqFilter !== undefined && seqFilter !== this.session) return;

    this._clearTimer('matchTimer');
    this._clearTimer('rematchTimer');
    this.matchedPeerId = null;

    if (this.room) {
      try {
        this.room.leave();
      } catch {
        /* already left */
      }
      this.room = null;
    }
    this.helloAction = null;
    this.chatAction = null;
    this.typingAction = null;
    this.callAction = null;
  }

  // ─── Media helpers ───────────────────────────────────────────────────────

  _ensureMedia(mode) {
    if (this.localStream) return this.localStream;
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === 'video',
    });
  }

  _setLocalStream(stream) {
    this.localStream = stream;
    this.handlers.onLocalStream?.(stream);
  }

  _stopLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.handlers.onLocalStream?.(null);
  }

  _hangupLocal(reason) {
    const { room, localStream, matchedPeerId } = this;
    if (matchedPeerId && localStream && room) {
      try {
        room.removeStream(localStream, { target: matchedPeerId });
      } catch {
        /* peer gone */
      }
    }
    this._stopLocalMedia();
    if (matchedPeerId && this.callAction) {
      try {
        this.callAction.send({ type: 'end' }, { target: matchedPeerId });
      } catch {
        /* peer gone */
      }
    }
    if (reason !== 'end' && reason !== 'next' && reason !== 'leave') {
      this.handlers.onCallState?.({ type: 'ended', reason });
    }
  }

  _clearTimer(name) {
    if (this[name]) {
      clearTimeout(this[name]);
      this[name] = null;
    }
  }
}

export const randomService = new RandomService();