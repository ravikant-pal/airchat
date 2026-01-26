import Peer from 'peerjs';
import { getAvatarFromCache, saveAvatarToCache } from './cacheService';
import { db } from './db';

class PeerService {
  peer = null;
  connections = new Map();
  onMessageCallback = null;
  onOnlineCallback = null;
  onOfflineCallback = null;
  onContactRequestCallback = null;
  onContactAcceptedCallback = null;
  onStatusCallback = null;
  heartbeatIntervals = new Map();

  init(peerId) {
    this.peer = new Peer(peerId);

    this.peer.on('connection', (conn) => {
      this._handleIncomingConnection(conn);
    });

    // Handle peer disconnection globally
    this.peer.on('disconnected', () => {
      console.log('Peer disconnected from server');
      // Try to reconnect to the signaling server
      if (!this.peer.destroyed) {
        this.peer.reconnect();
      }
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
    });
  }

  async _handleIncomingConnection(conn) {
    console.log(`Incoming connection from ${conn.peer}`);

    // Wait for the connection to open
    conn.on('open', async () => {
      console.log(`Connection opened with ${conn.peer}`);

      // Check if this is a reconnection from an accepted contact
      const contact = await db.contacts.get(conn.peer);

      if (contact?.isAccepted) {
        // This is a reconnection from an existing contact
        console.log(`Reconnection from accepted contact: ${conn.peer}`);

        // Register the connection immediately
        this._registerConnection(conn);

        await db.contacts.update(conn.peer, {
          online: true,
          connectionStatus: 'connected',
          lastSeen: null,
        });

        // Send any pending messages
        await this._sendPendingMessages(conn.peer);

        return;
      }

      // New connection - wait for handshake
      const firstMessage = await new Promise((resolve) => {
        const handler = (data) => {
          conn.off('data', handler);
          resolve(data);
        };
        conn.on('data', handler);
      });

      if (firstMessage.type === 'handshake_request') {
        // Store avatar data in cache if provided
        if (firstMessage.profile?.avatarData) {
          const avatarKey = `avatar_${conn.peer}`;
          await saveAvatarToCache(avatarKey, firstMessage.profile.avatarData);
          firstMessage.profile.avatarKey = avatarKey;
        }

        await db.pendingRequests.put({
          peerId: conn.peer,
          timestamp: Date.now(),
          direction: 'incoming',
          profile: firstMessage.profile,
        });

        if (this.onContactRequestCallback) {
          this.onContactRequestCallback(conn.peer, firstMessage);
        }

        this.connections.set(conn.peer, conn);
        this._setupConnectionHandlers(conn, false);
      } else if (firstMessage.type === 'handshake_accept') {
        console.log(`Received handshake acceptance from ${conn.peer}`);
        await this._finalizeHandshake(conn, firstMessage);
      }
    });

    conn.on('error', (err) => {
      console.error(`Incoming connection error from ${conn.peer}:`, err);
    });
  }

  async sendContactRequest(peerId, myProfile) {
    if (this.connections.has(peerId)) {
      console.log(`Already have connection to ${peerId}`);
      return;
    }

    const conn = this.peer.connect(peerId);

    conn.on('open', async () => {
      let avatarData = null;
      if (myProfile.avatarKey) {
        const avatarUrl = await getAvatarFromCache(myProfile.avatarKey);
        if (avatarUrl) {
          const response = await fetch(avatarUrl);
          const blob = await response.blob();
          avatarData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }
      }

      conn.send({
        type: 'handshake_request',
        peerId: this.peer.id,
        profile: {
          peerId: myProfile.peerId,
          name: myProfile.name,
          username: myProfile.username,
          avatarData: avatarData,
        },
        timestamp: Date.now(),
      });

      await db.pendingRequests.put({
        peerId: peerId,
        timestamp: Date.now(),
        direction: 'outgoing',
      });

      await db.contacts.put({
        peerId: peerId,
        name: peerId,
        online: false,
        connectionStatus: 'connecting',
        isAccepted: false,
        isTyping: false,
        lastSeen: null,
      });

      this.connections.set(peerId, conn);
      this._setupConnectionHandlers(conn, false);
    });

    conn.on('error', async (err) => {
      console.error('Connection error:', err);
      await db.contacts.update(peerId, {
        connectionStatus: 'disconnected',
        online: false,
      });
    });
  }

  async acceptContactRequest(peerId, myProfile) {
    const conn = this.connections.get(peerId);

    if (conn?.open) {
      let avatarData = null;
      if (myProfile.avatarKey) {
        const avatarUrl = await getAvatarFromCache(myProfile.avatarKey);
        if (avatarUrl) {
          const response = await fetch(avatarUrl);
          const blob = await response.blob();
          avatarData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }
      }

      conn.send({
        type: 'handshake_accept',
        peerId: this.peer.id,
        profile: {
          peerId: myProfile.peerId,
          name: myProfile.name,
          username: myProfile.username,
          avatarData: avatarData,
        },
        timestamp: Date.now(),
      });

      const pendingRequest = await db.pendingRequests.get(peerId);

      await this._finalizeHandshake(conn, {
        profile: pendingRequest?.profile || { name: peerId },
      });
    }
  }

  async rejectContactRequest(peerId) {
    const conn = this.connections.get(peerId);

    if (conn?.open) {
      conn.send({
        type: 'handshake_reject',
        peerId: this.peer.id,
      });
      conn.close();
    }

    await db.pendingRequests.delete(peerId);
    await db.contacts.delete(peerId);
    this.connections.delete(peerId);
  }

  async _finalizeHandshake(conn, data) {
    console.log(`Finalizing handshake with ${conn.peer}`);

    const profile = data.profile || {};

    let avatarKey = null;
    if (profile.avatarData) {
      avatarKey = `avatar_${conn.peer}`;
      await saveAvatarToCache(avatarKey, profile.avatarData);
    }

    await db.contacts.put({
      peerId: conn.peer,
      name: profile.name || profile.username || conn.peer,
      username: profile.username,
      avatarKey: avatarKey,
      online: true,
      connectionStatus: 'connected',
      isAccepted: true,
      isTyping: false,
      lastSeen: Date.now(),
    });

    await db.pendingRequests.delete(conn.peer);

    this._registerConnection(conn);

    if (this.onContactAcceptedCallback) {
      this.onContactAcceptedCallback(conn.peer, profile);
    }

    await this._sendPendingMessages(conn.peer);
  }

  _setupConnectionHandlers(conn, isAccepted) {
    console.log(
      `Setting up connection handlers for ${conn.peer}, isAccepted: ${isAccepted}`,
    );

    conn.on('data', async (data) => {
      console.log(`Received data from ${conn.peer}:`, data.type);

      if (data.type === 'handshake_accept' && !isAccepted) {
        console.log(`Processing handshake_accept from ${conn.peer}`);
        await this._finalizeHandshake(conn, data);
        return;
      }

      if (data.type === 'handshake_reject') {
        await db.contacts.delete(conn.peer);
        await db.pendingRequests.delete(conn.peer);
        this.connections.delete(conn.peer);
        conn.close();
        return;
      }

      if (data.type === 'profile_update') {
        let avatarKey = null;
        if (data.profile.avatarData) {
          avatarKey = `avatar_${conn.peer}`;
          await saveAvatarToCache(avatarKey, data.profile.avatarData);
        }

        await db.contacts.update(conn.peer, {
          name: data.profile.name,
          username: data.profile.username,
          avatarKey: avatarKey || data.profile.avatarKey,
        });
        return;
      }

      if (data.type === 'ping') {
        if (conn?.open) {
          conn.send({ type: 'pong', timestamp: Date.now() });
        }
        return;
      }

      if (data.type === 'pong') {
        await db.contacts.update(conn.peer, {
          online: true,
          lastSeen: Date.now(),
        });
        return;
      }

      // Acknowledge receipt of pending messages
      if (data.type === 'ack_pending') {
        console.log(`Received ack for pending messages from ${conn.peer}`);
        return;
      }

      if (data.type === 'message') {
        console.log(`Firing message callback for ${conn.peer}`);
        if (this.onMessageCallback) {
          this.onMessageCallback(conn.peer, data);
        }
        return;
      }

      if (data.type === 'status') {
        await db.messages
          .where('id')
          .equals(data.messageId)
          .modify({ status: data.status });

        if (this.onStatusCallback) {
          this.onStatusCallback(conn.peer, data);
        }
        return;
      }

      if (data.type === 'typing') {
        await db.contacts.update(conn.peer, {
          isTyping: data.isTyping,
        });

        if (this.onMessageCallback) {
          this.onMessageCallback(conn.peer, data);
        }
        return;
      }

      if (data.type === 'file') {
        console.log(`Firing file callback for ${conn.peer}`);
        if (this.onMessageCallback) {
          this.onMessageCallback(conn.peer, data);
        }
        return;
      }
    });

    conn.on('close', async () => {
      console.log(`Connection closed with ${conn.peer}`);

      // Clear heartbeat
      if (this.heartbeatIntervals.has(conn.peer)) {
        clearInterval(this.heartbeatIntervals.get(conn.peer));
        this.heartbeatIntervals.delete(conn.peer);
      }

      this.connections.delete(conn.peer);
      await db.contacts.update(conn.peer, {
        online: false,
        connectionStatus: 'disconnected',
        isTyping: false,
        lastSeen: Date.now(),
      });

      if (this.onOfflineCallback) {
        this.onOfflineCallback(conn.peer);
      }
    });

    conn.on('error', async (err) => {
      console.error(`Connection error with ${conn.peer}:`, err);

      // Clear heartbeat
      if (this.heartbeatIntervals.has(conn.peer)) {
        clearInterval(this.heartbeatIntervals.get(conn.peer));
        this.heartbeatIntervals.delete(conn.peer);
      }

      this.connections.delete(conn.peer);
      await db.contacts.update(conn.peer, {
        online: false,
        connectionStatus: 'disconnected',
        isTyping: false,
        lastSeen: Date.now(),
      });

      if (this.onOfflineCallback) {
        this.onOfflineCallback(conn.peer);
      }
    });
  }

  _registerConnection(conn) {
    console.log(`Registering connection for ${conn.peer}`);

    // Remove existing connection if any
    const existingConn = this.connections.get(conn.peer);
    if (existingConn && existingConn !== conn) {
      console.log(`Replacing existing connection for ${conn.peer}`);
      existingConn.close();
    }

    this.connections.set(conn.peer, conn);

    if (this.onOnlineCallback) {
      this.onOnlineCallback(conn.peer);
    }

    // Remove old handlers before setting up new ones
    conn.removeAllListeners('data');
    conn.removeAllListeners('close');
    conn.removeAllListeners('error');

    this._setupConnectionHandlers(conn, true);
    this._startHeartbeat(conn.peer);
  }

  _startHeartbeat(peerId) {
    // Clear existing heartbeat if any
    if (this.heartbeatIntervals.has(peerId)) {
      clearInterval(this.heartbeatIntervals.get(peerId));
    }

    const heartbeatInterval = setInterval(() => {
      const conn = this.connections.get(peerId);

      if (!conn || !conn.open) {
        clearInterval(heartbeatInterval);
        this.heartbeatIntervals.delete(peerId);
        return;
      }

      try {
        conn.send({ type: 'ping', timestamp: Date.now() });
      } catch (error) {
        console.error('Heartbeat failed:', error);
        clearInterval(heartbeatInterval);
        this.heartbeatIntervals.delete(peerId);
        this.connections.delete(peerId);
        db.contacts.update(peerId, {
          online: false,
          connectionStatus: 'disconnected',
          isTyping: false,
          lastSeen: Date.now(),
        });
      }
    }, 10000); // Ping every 10 seconds

    this.heartbeatIntervals.set(peerId, heartbeatInterval);
  }

  async _sendPendingMessages(peerId) {
    console.log(`Checking for pending messages to ${peerId}`);

    // Get messages that haven't been delivered yet
    const pendingMessages = await db.messages
      .where('peerId')
      .equals(peerId)
      .and(
        (msg) =>
          msg.sender === 'me' &&
          (msg.status === 'created' || msg.status === 'sent'),
      )
      .toArray();

    if (pendingMessages.length === 0) {
      console.log(`No pending messages for ${peerId}`);
      return;
    }

    const conn = this.connections.get(peerId);
    if (!conn?.open) {
      console.log(
        `Connection not open for ${peerId}, cannot send pending messages`,
      );
      return;
    }

    console.log(
      `Sending ${pendingMessages.length} pending messages to ${peerId}`,
    );

    for (const msg of pendingMessages) {
      try {
        if (msg.type === 'file') {
          conn.send({
            type: 'file',
            id: msg.id,
            fileName: msg.content,
            fileType: msg.fileType || 'application/octet-stream',
            fileBase64: msg.file,
            timestamp: msg.timestamp,
          });
        } else {
          conn.send({
            type: 'message',
            id: msg.id,
            text: msg.content,
            timestamp: msg.timestamp,
          });
        }

        // Update to 'sent' status
        await db.messages.update(msg.id, { status: 'sent' });
        console.log(`Sent pending message ${msg.id} to ${peerId}`);
      } catch (error) {
        console.error(`Failed to send pending message ${msg.id}:`, error);
        // Don't break the loop, try to send other messages
      }
    }

    // Notify peer that we've sent all pending messages
    try {
      conn.send({ type: 'ack_pending', timestamp: Date.now() });
    } catch (error) {
      console.error('Failed to send ack_pending:', error);
    }
  }

  isConnected(peerId) {
    const conn = this.connections.get(peerId);
    return conn && conn.open;
  }

  async connect(peerId) {
    const contact = await db.contacts.get(peerId);

    if (!contact?.isAccepted) {
      console.warn('Cannot connect to non-accepted contact');
      throw new Error('Cannot connect to non-accepted contact');
    }

    // If already connected, just return
    if (this.isConnected(peerId)) {
      console.log(`Already connected to ${peerId}`);
      return;
    }

    console.log(`Initiating connection to ${peerId}`);

    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(peerId);
      let connectionTimeout;

      connectionTimeout = setTimeout(() => {
        if (!conn.open) {
          conn.close();
          reject(new Error('Connection timeout'));
        }
      }, 30000);

      conn.on('open', async () => {
        clearTimeout(connectionTimeout);
        console.log(`Successfully connected to ${peerId}`);

        this._registerConnection(conn);
        await db.contacts.update(peerId, {
          online: true,
          connectionStatus: 'connected',
          lastSeen: null,
        });

        // Send pending messages after connection is established
        await this._sendPendingMessages(peerId);

        resolve();
      });

      conn.on('error', async (err) => {
        clearTimeout(connectionTimeout);
        console.error('Connection error:', err);

        await db.contacts.update(peerId, {
          connectionStatus: 'disconnected',
          online: false,
          lastSeen: Date.now(),
        });

        reject(err);
      });

      conn.on('close', async () => {
        clearTimeout(connectionTimeout);
        console.log(`Connection closed to ${peerId}`);

        if (this.heartbeatIntervals.has(peerId)) {
          clearInterval(this.heartbeatIntervals.get(peerId));
          this.heartbeatIntervals.delete(peerId);
        }

        this.connections.delete(peerId);
        await db.contacts.update(peerId, {
          online: false,
          connectionStatus: 'disconnected',
          isTyping: false,
          lastSeen: Date.now(),
        });
      });
    });
  }

  async send(peerId, data) {
    const conn = this.connections.get(peerId);
    const contact = await db.contacts.get(peerId);

    if (!contact?.isAccepted) {
      console.warn('Cannot send message to non-accepted contact');
      return false;
    }

    if (conn?.open) {
      try {
        conn.send(data);
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        this.connections.delete(peerId);
        await db.contacts.update(peerId, {
          online: false,
          connectionStatus: 'disconnected',
          isTyping: false,
          lastSeen: Date.now(),
        });
        return false;
      }
    } else {
      console.log(`Not connected to ${peerId}, message will be pending`);
      await db.contacts.update(peerId, {
        online: false,
        connectionStatus: 'disconnected',
        isTyping: false,
        lastSeen: Date.now(),
      });
      return false;
    }
  }

  async broadcastProfileUpdate(myProfile) {
    let avatarData = null;
    if (myProfile.avatarKey) {
      const avatarUrl = await getAvatarFromCache(myProfile.avatarKey);
      if (avatarUrl) {
        const response = await fetch(avatarUrl);
        const blob = await response.blob();
        avatarData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
    }

    const profileData = {
      type: 'profile_update',
      profile: {
        peerId: myProfile.peerId,
        name: myProfile.name,
        username: myProfile.username,
        avatarData: avatarData,
      },
    };

    for (const [peerId, conn] of this.connections.entries()) {
      if (conn?.open) {
        conn.send(profileData);
      }
    }
  }

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

export const peerService = new PeerService();
