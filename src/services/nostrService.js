/**
 * nostrService.js — drop-in replacement for peerService.js
 *
 * What changed vs PeerJS:
 *  - PeerJS cloud server  →  Nostr public relays  (free, no account)
 *  - PeerJS DataConnection →  native RTCPeerConnection + RTCDataChannel
 *  - Signaling             →  Nostr NIP-04 encrypted DMs
 *  - Offline fallback      →  Nostr DM held by relay until peer reconnects
 *  - Identity (peerId)     →  Nostr hex pubkey (generated once, stored in localStorage)
 *
 * Everything else (App.jsx, ChatWindow, ChatInput, db.js) is unchanged.
 * Just change the import in App.jsx:
 *   import { nostrService as peerService } from '../services/nostrService'
 */

import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NDKUser,
} from '@nostr-dev-kit/ndk';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { getAvatarFromCache, saveAvatarToCache } from './cacheService';
import { db } from './db';

// Free public Nostr relays — only used for signaling handshake + offline fallback
// Your actual chat data goes over direct WebRTC after handshake
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://nostr.pub',
  'wss://relay.nostr.band',
  'wss://relay.noswhere.com',
  'wss://search.nos.today',
  'wss://nostr.oxtr.dev',
  'wss://relay.orangepill.dev',
];

// Google STUN — free, no account needed, handles NAT traversal
const STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
];

const bytesToHex = (b) =>
  Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

const hexToBytes = (hex) =>
  Uint8Array.from(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

class NostrService {
  ndk = null;
  myPubKey = null; // hex Nostr pubkey — this becomes the user's peerId
  myPrivKey = null; // hex Nostr privkey — never leaves device

  connections = new Map(); // pubkey → RTCPeerConnection
  dataChannels = new Map(); // pubkey → RTCDataChannel
  heartbeatIntervals = new Map();
  processedEventIds = new Set(); // deduplicate replayed Nostr events
  initTime = Math.floor(Date.now() / 1000); // unix seconds — ignore events older than this for handshakes

  onMessageCallback = null;
  onStatusCallback = null;
  onOnlineCallback = null;
  onOfflineCallback = null;
  onContactRequestCallback = null;
  onContactAcceptedCallback = null;

  // ─── Static helper ────────────────────────────────────────────────────────
  // Called by ProfileDialog BEFORE init() so the profile is saved with the
  // correct Nostr pubkey from the very first time.
  static getPubKey() {
    let privKeyHex = localStorage.getItem('airchat_nostr_privkey');
    if (!privKeyHex) {
      const sk = generateSecretKey();
      privKeyHex = bytesToHex(sk);
      localStorage.setItem('airchat_nostr_privkey', privKeyHex);
    }
    return getPublicKey(hexToBytes(privKeyHex));
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async init(peerId) {
    // Load or generate Nostr keypair (stored in localStorage — never sent anywhere)
    let privKeyHex = localStorage.getItem('airchat_nostr_privkey');

    if (!privKeyHex) {
      const sk = generateSecretKey(); // generates Uint8Array
      privKeyHex = bytesToHex(sk);
      localStorage.setItem('airchat_nostr_privkey', privKeyHex);
      console.log('Generated new Nostr keypair');
    }

    const pubKeyHex = getPublicKey(hexToBytes(privKeyHex));
    this.myPrivKey = privKeyHex;
    this.myPubKey = pubKeyHex;

    // If profile's peerId is a different format (old UUID), migrate it to pubkey
    if (peerId !== pubKeyHex) {
      const profile = await db.profile.toCollection().first();
      if (profile) {
        await db.profile.delete(profile.peerId);
        await db.profile.put({ ...profile, peerId: pubKeyHex });
        console.log('Migrated profile peerId to Nostr pubkey');
      }
    }

    // NDK without cache adapter — avoids NDKCacheDexie's iterable bug
    // NDK works fine without it; Nostr events are fetched fresh from relays
    this.ndk = new NDK({
      explicitRelayUrls: RELAYS,
      signer: new NDKPrivateKeySigner(privKeyHex),
    });

    await this.ndk.connect();
    console.log('Nostr connected | pubkey:', pubKeyHex.slice(0, 12) + '…');

    // Listen for incoming encrypted DMs addressed to us
    this._subscribe();
  }

  _subscribe() {
    const sub = this.ndk.subscribe(
      {
        kinds: [4], // NIP-04 encrypted direct messages
        '#p': [this.myPubKey], // only events addressed to me
        since: Math.floor(Date.now() / 1000) - 86400, // last 24h (catch offline msgs)
      },
      { closeOnEose: false } // keep subscription open for new events
    );
    sub.on('event', (event) => this._handleNostrEvent(event));
  }

  async _handleNostrEvent(event) {
    const fromPubKey = event.pubkey;
    if (fromPubKey === this.myPubKey) return; // ignore echoes of own events

    // Deduplicate — Nostr relays replay historical events on every reconnect
    if (this.processedEventIds.has(event.id)) return;
    this.processedEventIds.add(event.id);
    // Keep set bounded — drop oldest entries after 500
    if (this.processedEventIds.size > 500) {
      const first = this.processedEventIds.values().next().value;
      this.processedEventIds.delete(first);
    }

    // Decrypt with our private key
    let content;
    try {
      const sender = new NDKUser({ pubkey: fromPubKey });
      const decrypted = await this.ndk.signer.decrypt(sender, event.content);
      content = JSON.parse(decrypted);
    } catch (e) {
      console.error('Failed to decrypt Nostr event:', e);
      return;
    }

    console.log(`[nostr] from ${fromPubKey.slice(0, 8)}:`, content.type);

    switch (content.type) {
      case 'handshake_request':
        return this._onHandshakeRequest(fromPubKey, content, event.created_at);
      case 'handshake_accept':
        return this._onHandshakeAccept(fromPubKey, content);
      case 'handshake_reject':
        await db.contacts.delete(fromPubKey);
        await db.pendingRequests.delete(fromPubKey);
        return;
      case 'webrtc_offer':
        return this._onWebRTCOffer(fromPubKey, content);
      case 'webrtc_answer':
        return this._onWebRTCAnswer(fromPubKey, content);
      // Async fallback: messages delivered via Nostr when WebRTC was unavailable
      case 'message':
      case 'file':
        if (this.onMessageCallback) this.onMessageCallback(fromPubKey, content);
        return;
      case 'status':
        if (this.onStatusCallback) this.onStatusCallback(fromPubKey, content);
        return;
    }
  }

  // Send an encrypted Nostr DM — used for signaling + offline message fallback
  async _sendDM(toPubKey, content) {
    const recipient = new NDKUser({ pubkey: toPubKey });
    const encrypted = await this.ndk.signer.encrypt(
      recipient,
      JSON.stringify(content)
    );
    const event = new NDKEvent(this.ndk, {
      kind: 4,
      content: encrypted,
      tags: [['p', toPubKey]],
    });
    await event.publish();
  }

  // ─── Contact Requests ─────────────────────────────────────────────────────

  async sendContactRequest(peerId, myProfile) {
    // Send handshake via Nostr — peer can be offline, relay holds it
    await this._sendDM(peerId, {
      type: 'handshake_request',
      profile: await this._buildProfilePayload(myProfile),
      timestamp: Date.now(),
    });

    await db.pendingRequests.put({
      peerId,
      timestamp: Date.now(),
      direction: 'outgoing',
    });
    await db.contacts.put({
      peerId,
      name: peerId.slice(0, 12) + '…',
      online: false,
      connectionStatus: 'connecting',
      isAccepted: false,
      isTyping: false,
      lastSeen: null,
    });
  }

  async _onHandshakeRequest(fromPubKey, content, eventCreatedAt) {
    // Ignore stale handshake requests replayed from before this session
    if (eventCreatedAt < this.initTime - 10) {
      console.log(
        `[nostr] ignoring stale handshake_request from ${fromPubKey.slice(0, 8)}`
      );
      return;
    }

    // Ignore if already an accepted contact — prevents dialog re-appearing on relay replay
    const existing = await db.contacts.get(fromPubKey);
    if (existing?.isAccepted) {
      console.log(
        `[nostr] ignoring handshake_request from already-accepted contact ${fromPubKey.slice(0, 8)}`
      );
      // They may have lost their state — re-send acceptance silently
      const myProfile = await db.profile.toCollection().first();
      if (myProfile) {
        await this._sendDM(fromPubKey, {
          type: 'handshake_accept',
          profile: await this._buildProfilePayload(myProfile),
          timestamp: Date.now(),
        });
        // Kick off WebRTC reconnect
        if (!this.isConnected(fromPubKey))
          await this._initiateWebRTC(fromPubKey);
      }
      return;
    }

    if (content.profile?.avatarData) {
      const key = `avatar_${fromPubKey}`;
      await saveAvatarToCache(key, content.profile.avatarData);
      content.profile.avatarKey = key;
    }
    await db.pendingRequests.put({
      peerId: fromPubKey,
      timestamp: Date.now(),
      direction: 'incoming',
      profile: content.profile,
    });
    if (this.onContactRequestCallback)
      this.onContactRequestCallback(fromPubKey, content);
  }

  async acceptContactRequest(peerId, myProfile) {
    await this._sendDM(peerId, {
      type: 'handshake_accept',
      profile: await this._buildProfilePayload(myProfile),
      timestamp: Date.now(),
    });
    const req = await db.pendingRequests.get(peerId);
    await this._finalizeContact(peerId, req?.profile || {});

    // Acceptor initiates WebRTC — sender waits for our offer
    await this._initiateWebRTC(peerId);
  }

  async _onHandshakeAccept(fromPubKey, content) {
    await this._finalizeContact(fromPubKey, content.profile || {});
    // Original sender: they accepted us, they'll send the WebRTC offer, we wait
  }

  async rejectContactRequest(peerId) {
    await this._sendDM(peerId, { type: 'handshake_reject' });
    await db.pendingRequests.delete(peerId);
    await db.contacts.delete(peerId);
  }

  async _finalizeContact(peerId, profile) {
    let avatarKey = null;
    if (profile.avatarData) {
      avatarKey = `avatar_${peerId}`;
      await saveAvatarToCache(avatarKey, profile.avatarData);
    }
    await db.contacts.put({
      peerId,
      name: profile.name || profile.username || peerId.slice(0, 12),
      username: profile.username,
      avatarKey: avatarKey || profile.avatarKey || null,
      online: false,
      connectionStatus: 'connecting',
      isAccepted: true,
      isTyping: false,
      lastSeen: null,
    });
    await db.pendingRequests.delete(peerId);
    if (this.onContactAcceptedCallback)
      this.onContactAcceptedCallback(peerId, profile);
  }

  // ─── WebRTC ───────────────────────────────────────────────────────────────

  async _initiateWebRTC(peerId) {
    const pc = this._createPC(peerId);

    // Create data channel before offer (required by WebRTC spec)
    const dc = pc.createDataChannel('chat');
    this._wireDataChannel(peerId, dc);
    this.dataChannels.set(peerId, dc);

    // Create offer, wait for ALL ICE candidates (non-trickle — simpler)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this._waitForICE(pc); // wait for Google STUN to gather candidates

    // Send complete offer (with ICE candidates baked in) via Nostr
    await this._sendDM(peerId, {
      type: 'webrtc_offer',
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    });
    console.log(`[webrtc] offer sent to ${peerId.slice(0, 8)}`);
  }

  async _onWebRTCOffer(fromPubKey, content) {
    // Ignore replayed offers if already connected via data channel
    if (this.isConnected(fromPubKey)) {
      console.log(
        `[webrtc] offer from ${fromPubKey.slice(0, 8)} ignored — already connected`
      );
      return;
    }

    // Handle simultaneous offers (both sides reconnected at same time)
    // Lower pubkey wins — the other side discards their offer and accepts ours
    if (this.connections.has(fromPubKey)) {
      if (this.myPubKey < fromPubKey) return; // our offer wins, ignore theirs
      // Their offer wins — tear down our pending connection
      this.connections.get(fromPubKey).close();
      this.connections.delete(fromPubKey);
      this.dataChannels.delete(fromPubKey);
    }

    const pc = this._createPC(fromPubKey);

    // Receive data channel from initiator
    pc.ondatachannel = ({ channel }) => {
      this._wireDataChannel(fromPubKey, channel);
      this.dataChannels.set(fromPubKey, channel);
    };

    await pc.setRemoteDescription(content.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this._waitForICE(pc);

    await this._sendDM(fromPubKey, {
      type: 'webrtc_answer',
      sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
    });
    console.log(`[webrtc] answer sent to ${fromPubKey.slice(0, 8)}`);
  }

  async _onWebRTCAnswer(fromPubKey, content) {
    const pc = this.connections.get(fromPubKey);
    if (!pc) {
      console.log(
        `[webrtc] answer from ${fromPubKey.slice(0, 8)} ignored — no PC exists`
      );
      return;
    }
    // Only apply answer when we're in 'have-local-offer' state
    // 'stable' means we're already connected — this is a replayed/duplicate answer
    if (pc.signalingState !== 'have-local-offer') {
      console.log(
        `[webrtc] answer from ${fromPubKey.slice(0, 8)} ignored — state is '${pc.signalingState}' not 'have-local-offer'`
      );
      return;
    }
    await pc.setRemoteDescription(content.sdp);
    console.log(`[webrtc] answer applied from ${fromPubKey.slice(0, 8)}`);
  }

  _createPC(peerId) {
    const pc = new RTCPeerConnection({ iceServers: STUN });
    this.connections.set(peerId, pc);

    pc.oniceconnectionstatechange = async () => {
      const s = pc.iceConnectionState;
      console.log(`[webrtc] ICE ${peerId.slice(0, 8)}: ${s}`);

      if (s === 'connected' || s === 'completed') {
        await db.contacts.update(peerId, {
          online: true,
          connectionStatus: 'connected',
          lastSeen: null,
        });
        if (this.onOnlineCallback) this.onOnlineCallback(peerId);
        this._startHeartbeat(peerId);
        // NOTE: _sendPendingMessages is called in dc.onopen, not here.
        // ICE 'connected' fires before the data channel is actually open.
      }

      if (s === 'disconnected' || s === 'failed' || s === 'closed') {
        this._teardown(peerId);
        await db.contacts.update(peerId, {
          online: false,
          connectionStatus: 'disconnected',
          isTyping: false,
          lastSeen: Date.now(),
        });
        if (this.onOfflineCallback) this.onOfflineCallback(peerId);
      }
    };

    return pc;
  }

  _wireDataChannel(peerId, dc) {
    dc.onopen = async () => {
      console.log(`[dc] open with ${peerId.slice(0, 8)}`);
      // Data channel is ACTUALLY open here — safe to send pending messages now.
      // ICE 'connected' fires before dc.onopen so calling _sendPendingMessages
      // in oniceconnectionstatechange was too early — channel wasn't open yet.
      await this._sendPendingMessages(peerId);
    };
    dc.onclose = () => console.log(`[dc] closed with ${peerId.slice(0, 8)}`);
    dc.onmessage = ({ data }) => this._onDCMessage(peerId, JSON.parse(data));
  }

  async _onDCMessage(peerId, data) {
    switch (data.type) {
      case 'message':
      case 'file':
        if (this.onMessageCallback) this.onMessageCallback(peerId, data);
        break;
      case 'status':
        if (this.onStatusCallback) this.onStatusCallback(peerId, data);
        break;
      case 'typing':
        await db.contacts.update(peerId, { isTyping: data.isTyping });
        break;
      case 'ping':
        this._dcSend(peerId, { type: 'pong', timestamp: Date.now() });
        break;
      case 'pong':
        await db.contacts.update(peerId, { online: true });
        break;
      case 'profile_update':
        await this._applyProfileUpdate(peerId, data.profile);
        break;
      case 'ack_pending':
        break;
    }
  }

  // Wait for ICE gathering to finish before sending offer/answer
  // This sends ALL candidates at once (non-trickle) — simpler, works on mobile
  _waitForICE(pc) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve();
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') resolve();
      };
      setTimeout(resolve, 8000); // 8s max — covers slow mobile STUN lookups
    });
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  _dcSend(peerId, data) {
    const dc = this.dataChannels.get(peerId);
    if (dc?.readyState === 'open') {
      dc.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  async send(peerId, data) {
    const contact = await db.contacts.get(peerId);
    if (!contact?.isAccepted) return false;

    // Path 1: WebRTC data channel — fast, direct P2P
    if (this._dcSend(peerId, data)) return true;

    // Path 2: Nostr DM fallback — used when WebRTC is not yet connected
    // Covers: messages, files, AND status updates (delivered/seen receipts).
    // Without status fallback, B never knows A received offline messages.
    if (
      data.type === 'message' ||
      data.type === 'file' ||
      data.type === 'status'
    ) {
      await this._sendDM(peerId, data);
      return true;
    }

    // typing, ping, pong, ack_pending — real-time only, drop if offline
    return false;
  }

  isConnected(peerId) {
    return this.dataChannels.get(peerId)?.readyState === 'open';
  }

  async connect(peerId) {
    if (this.isConnected(peerId)) return;
    await this._initiateWebRTC(peerId);
  }

  async _sendPendingMessages(peerId) {
    const dc = this.dataChannels.get(peerId);
    if (dc?.readyState !== 'open') {
      console.log(
        `[dc] _sendPendingMessages: channel not open for ${peerId.slice(0, 8)}, skipping`
      );
      return;
    }

    const pending = await db.messages
      .where('peerId')
      .equals(peerId)
      .and(
        (m) =>
          m.sender === 'me' && (m.status === 'created' || m.status === 'sent')
      )
      .toArray();

    if (pending.length === 0) return;
    console.log(
      `[dc] sending ${pending.length} pending messages to ${peerId.slice(0, 8)}`
    );

    for (const msg of pending) {
      // Re-check channel is still open for each message (long queues can disconnect mid-send)
      if (this.dataChannels.get(peerId)?.readyState !== 'open') break;

      const payload =
        msg.type === 'file'
          ? {
              type: 'file',
              id: msg.id,
              fileName: msg.content,
              fileType: msg.fileType,
              fileBase64: msg.file,
              timestamp: msg.timestamp,
            }
          : {
              type: 'message',
              id: msg.id,
              text: msg.content,
              timestamp: msg.timestamp,
            };

      if (this._dcSend(peerId, payload)) {
        await db.messages.update(msg.id, { status: 'sent' });
        console.log(
          `[dc] delivered pending msg ${msg.id.slice(0, 8)} to ${peerId.slice(0, 8)}`
        );
      }
    }

    this._dcSend(peerId, { type: 'ack_pending', timestamp: Date.now() });
  }

  // ─── Heartbeat ────────────────────────────────────────────────────────────

  _startHeartbeat(peerId) {
    if (this.heartbeatIntervals.has(peerId))
      clearInterval(this.heartbeatIntervals.get(peerId));

    const id = setInterval(() => {
      if (!this._dcSend(peerId, { type: 'ping', timestamp: Date.now() })) {
        clearInterval(id);
        this.heartbeatIntervals.delete(peerId);
      }
    }, 10000);

    this.heartbeatIntervals.set(peerId, id);
  }

  _teardown(peerId) {
    if (this.heartbeatIntervals.has(peerId)) {
      clearInterval(this.heartbeatIntervals.get(peerId));
      this.heartbeatIntervals.delete(peerId);
    }
    this.connections.delete(peerId);
    this.dataChannels.delete(peerId);
  }

  // ─── Profile ──────────────────────────────────────────────────────────────

  async broadcastProfileUpdate(myProfile) {
    const profile = await this._buildProfilePayload(myProfile);
    for (const [peerId] of this.dataChannels) {
      this.send(peerId, { type: 'profile_update', profile });
    }
  }

  async _applyProfileUpdate(peerId, profile) {
    let avatarKey = null;
    if (profile?.avatarData) {
      avatarKey = `avatar_${peerId}`;
      await saveAvatarToCache(avatarKey, profile.avatarData);
    }
    await db.contacts.update(peerId, {
      name: profile.name,
      username: profile.username,
      avatarKey: avatarKey || profile.avatarKey,
    });
  }

  async _buildProfilePayload(myProfile) {
    let avatarData = null;
    if (myProfile.avatarKey) {
      const url = await getAvatarFromCache(myProfile.avatarKey);
      if (url) {
        const blob = await fetch(url).then((r) => r.blob());
        avatarData = await new Promise((res) => {
          const fr = new FileReader();
          fr.onloadend = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
      }
    }
    return {
      peerId: this.myPubKey,
      name: myProfile.name,
      username: myProfile.username,
      avatarData,
    };
  }

  // ─── Callbacks (same API as peerService) ──────────────────────────────────

  onMessage(cb) {
    this.onMessageCallback = cb;
  }
  onStatus(cb) {
    this.onStatusCallback = cb;
  }
  onPeerOnline(cb) {
    this.onOnlineCallback = cb;
  }
  onPeerOffline(cb) {
    this.onOfflineCallback = cb;
  }
  onContactRequest(cb) {
    this.onContactRequestCallback = cb;
  }
  onContactAccepted(cb) {
    this.onContactAcceptedCallback = cb;
  }
}

export const nostrService = new NostrService();

// Standalone helper — import this directly in ProfileDialog
// Works before nostrService.init() is called
export function getPubKey() {
  let privKeyHex = localStorage.getItem('airchat_nostr_privkey');
  if (!privKeyHex) {
    const sk = generateSecretKey();
    privKeyHex = bytesToHex(sk);
    localStorage.setItem('airchat_nostr_privkey', privKeyHex);
  }
  return getPublicKey(hexToBytes(privKeyHex));
}
