import { joinRoom } from 'trystero/torrent';

class P2PService {
  constructor() {
    this.rooms = new Map(); // roomId -> room instance
    this.peers = new Map(); // roomId -> Set of peerIds
    this.actions = new Map(); // roomId -> { sendMessage, sendHandshake }
    this.connecting = new Set(); // 🔒 NEW
    this.listeners = {
      onPeerJoin: [],
      onPeerLeave: [],
      onMessage: [],
      onHandshake: [],
    };
  }

  connectToRoom(roomId, profile) {
    if (this.rooms.has(roomId)) {
      console.log('Already connected to room:', roomId);
      return this.rooms.get(roomId);
    }

    if (this.connecting.has(roomId)) {
      console.log('⏳ Already connecting to room:', roomId);
      return;
    }

    this.connecting.add(roomId);

    try {
      const config = {
        appId: 'airchat-p2p-v1',
        trackerUrls: [
          'wss://tracker.openwebtorrent.com',
          'wss://tracker.webtorrent.dev',
        ],
      };

      console.log('🔗 Connecting to room:', roomId);
      const room = joinRoom(config, roomId);
      this.rooms.set(roomId, room);
      this.peers.set(roomId, new Set());

      // Setup message action
      const [sendMsg, getMsg] = room.makeAction('message');
      const [sendReceipt, getReceipt] = room.makeAction('receipt');
      getMsg((data, peerId) => {
        this.emit('onMessage', { data, peerId, roomId });
      });

      getReceipt((data, peerId) => {
        this.emit('onReceipt', { data, peerId, roomId });
      });

      // Setup handshake action
      const [sendHs, getHs] = room.makeAction('handshake');
      getHs((data, peerId) => {
        this.emit('onHandshake', { data, peerId, roomId });
      });

      this.actions.set(roomId, {
        sendMessage: sendMsg,
        sendHandshake: sendHs,
        sendReceipt,
      });

      // Handle peer connections
      room.onPeerJoin((peerId) => {
        console.log(`✅ Peer joined room ${roomId}:`, peerId);
        const roomPeers = this.peers.get(roomId);
        roomPeers.add(peerId);
        this.emit('onPeerJoin', { peerId, roomId });

        // Send handshake immediately
        sendHs({
          displayName: profile.displayName,
          username: profile.username,
          personalRoomId: profile.personalRoomId,
        });
      });

      room.onPeerLeave((peerId) => {
        console.log(`❌ Peer left room ${roomId}:`, peerId);
        const roomPeers = this.peers.get(roomId);
        roomPeers.delete(peerId);
        this.emit('onPeerLeave', { peerId, roomId });
      });

      return room;
    } finally {
      this.connecting.delete(roomId);
    }
  }

  sendMessage(roomId, message) {
    const actions = this.actions.get(roomId);
    const peers = this.peers.get(roomId);
    if (!actions?.sendMessage) {
      console.warn('No sendMessage action for room', roomId);
      return;
    }
    if (!peers || peers.size === 0) {
      console.warn('No peers in room', roomId);
      return;
    }

    actions.sendMessage(message);
  }

  sendHandshake(roomId, data) {
    const actions = this.actions.get(roomId);
    if (actions?.sendHandshake) {
      actions.sendHandshake(data);
    }
  }

  disconnectFromRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.leave();
      this.rooms.delete(roomId);
      this.peers.delete(roomId);
      this.actions.delete(roomId);
    }
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback,
      );
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }

  getPeersInRoom(roomId) {
    const roomPeers = this.peers.get(roomId);
    return roomPeers ? Array.from(roomPeers) : [];
  }

  isPeerOnlineInRoom(roomId, peerId) {
    const roomPeers = this.peers.get(roomId);
    return roomPeers ? roomPeers.has(peerId) : false;
  }

  getAllConnectedRooms() {
    return Array.from(this.rooms.keys());
  }

  disconnectAll() {
    this.rooms.forEach((room, roomId) => {
      room.leave();
    });
    this.rooms.clear();
    this.peers.clear();
    this.actions.clear();
  }
}

export const p2pService = new P2PService();
export default p2pService;
