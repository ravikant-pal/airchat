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

  init(peerId) {
    this.peer = new Peer(peerId);

    this.peer.on('connection', (conn) => {
      this._handleIncomingConnection(conn);
    });
  }

  async _handleIncomingConnection(conn) {
    // Wait for the connection to open
    conn.on('open', async () => {
      // Check if this is a handshake request
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

          // Update profile to use the cache key
          firstMessage.profile.avatarKey = avatarKey;
        }

        // Store as pending incoming request with profile info
        await db.pendingRequests.put({
          peerId: conn.peer,
          timestamp: Date.now(),
          direction: 'incoming',
          profile: firstMessage.profile, // Store the sender's profile
        });

        // Notify UI about new contact request
        if (this.onContactRequestCallback) {
          this.onContactRequestCallback(conn.peer, firstMessage);
        }

        // Keep connection in a temporary map
        this.connections.set(conn.peer, conn);
        this._setupConnectionHandlers(conn, false); // not accepted yet
      } else if (firstMessage.type === 'handshake_accept') {
        // The other user accepted our request
        await this._finalizeHandshake(conn, firstMessage);
      }
    });
  }

  async sendContactRequest(peerId, myProfile) {
    if (this.connections.has(peerId)) return;

    const conn = this.peer.connect(peerId);

    conn.on('open', async () => {
      // Get avatar data from cache if exists
      let avatarData = null;
      if (myProfile.avatarKey) {
        const avatarUrl = await getAvatarFromCache(myProfile.avatarKey);
        if (avatarUrl) {
          // Convert blob URL to base64
          const response = await fetch(avatarUrl);
          const blob = await response.blob();
          avatarData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }
      }

      // Send handshake request with full profile including avatar data
      conn.send({
        type: 'handshake_request',
        peerId: this.peer.id,
        profile: {
          peerId: myProfile.peerId,
          name: myProfile.name,
          username: myProfile.username,
          avatarData: avatarData, // Send actual avatar data
        },
        timestamp: Date.now(),
      });

      // Store as pending outgoing request
      await db.pendingRequests.put({
        peerId: peerId,
        timestamp: Date.now(),
        direction: 'outgoing',
      });

      // Update contact status with basic info
      await db.contacts.put({
        peerId: peerId,
        name: peerId, // Will be updated when accepted
        online: false,
        connectionStatus: 'connecting',
        isAccepted: false,
        lastSeen: null,
      });

      // Temporarily store connection
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
      // Get avatar data from cache if exists
      let avatarData = null;
      if (myProfile.avatarKey) {
        const avatarUrl = await getAvatarFromCache(myProfile.avatarKey);
        if (avatarUrl) {
          // Convert blob URL to base64
          const response = await fetch(avatarUrl);
          const blob = await response.blob();
          avatarData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }
      }

      // Send acceptance with your profile info including avatar data
      conn.send({
        type: 'handshake_accept',
        peerId: this.peer.id,
        profile: {
          peerId: myProfile.peerId,
          name: myProfile.name,
          username: myProfile.username,
          avatarData: avatarData, // Send actual avatar data
        },
        timestamp: Date.now(),
      });

      // Get the requester's profile from pending requests
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
    // Register the connection as accepted
    this._registerConnection(conn);

    const profile = data.profile || {};

    // Store avatar data in cache if provided
    let avatarKey = null;
    if (profile.avatarData) {
      avatarKey = `avatar_${conn.peer}`;
      await saveAvatarToCache(avatarKey, profile.avatarData);
    }

    // Update contact in database with full profile info
    await db.contacts.put({
      peerId: conn.peer,
      name: profile.name || profile.username || conn.peer,
      username: profile.username,
      avatarKey: avatarKey, // Store the cache key, not the data
      online: true,
      connectionStatus: 'connected',
      isAccepted: true,
      lastSeen: Date.now(),
    });

    // Remove from pending requests
    await db.pendingRequests.delete(conn.peer);

    // Notify UI
    if (this.onContactAcceptedCallback) {
      this.onContactAcceptedCallback(conn.peer, profile);
    }

    // Send pending messages
    await this._sendPendingMessages(conn.peer);
  }

  _setupConnectionHandlers(conn, isAccepted) {
    conn.on('data', async (data) => {
      if (data.type === 'handshake_accept' && !isAccepted) {
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
        // Store avatar data in cache if provided
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

      if (data.type === 'message') {
        // ONLY fire callback - DO NOT add to database here
        if (this.onMessageCallback) {
          this.onMessageCallback(conn.peer, data);
        }
        return;
      }

      if (data.type === 'status') {
        // Update message status
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
        await db.typing.put({ peerId: conn.peer, isTyping: data.isTyping });
        if (this.onMessageCallback) {
          this.onMessageCallback(conn.peer, data);
        }
        return;
      }

      if (data.type === 'file') {
        // ONLY fire callback - DO NOT add to database here
        if (this.onMessageCallback) {
          this.onMessageCallback(conn.peer, data);
        }
        return;
      }
    });

    conn.on('close', async () => {
      this.connections.delete(conn.peer);
      await db.contacts.update(conn.peer, {
        online: false,
        connectionStatus: 'disconnected',
        lastSeen: Date.now(),
      });
      this.onOfflineCallback?.(conn.peer);
    });
  }

  _registerConnection(conn) {
    this.connections.set(conn.peer, conn);

    if (this.onOnlineCallback) {
      this.onOnlineCallback(conn.peer);
    }

    this._setupConnectionHandlers(conn, true);
  }

  async _sendPendingMessages(peerId) {
    const pendingMessages = await db.messages
      .where({ peerId: peerId, status: 'created' })
      .toArray();

    const conn = this.connections.get(peerId);
    if (!conn?.open) return;

    for (const msg of pendingMessages) {
      conn.send({
        type: 'message',
        id: msg.id,
        content: msg.content,
        timestamp: msg.timestamp,
        messageType: msg.type,
      });

      await db.messages.update(msg.id, { status: 'sent' });
    }
  }

  async connect(peerId) {
    const contact = await db.contacts.get(peerId);

    if (!contact?.isAccepted) {
      console.warn('Cannot connect to non-accepted contact');
      throw new Error('Cannot connect to non-accepted contact');
    }

    // If already connected, just return
    if (this.connections.has(peerId)) {
      console.log(`Already connected to ${peerId}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(peerId);
      let connectionTimeout;

      // Set a timeout for connection attempt (30 seconds)
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

        this.connections.delete(peerId);
        await db.contacts.update(peerId, {
          online: false,
          connectionStatus: 'disconnected',
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
      return;
    }

    if (conn?.open) {
      conn.send(data);
    } else {
      // Store as pending message
      await db.messages.put({
        peerId: peerId,
        sender: this.peer.id,
        content: data.content,
        timestamp: Date.now(),
        type: data.messageType || 'text',
        status: 'created',
      });
    }
  }

  // Method to broadcast profile updates to all connected peers
  async broadcastProfileUpdate(myProfile) {
    // Get avatar data from cache if exists
    let avatarData = null;
    if (myProfile.avatarKey) {
      const avatarUrl = await getAvatarFromCache(myProfile.avatarKey);
      if (avatarUrl) {
        // Convert blob URL to base64
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
        avatarData: avatarData, // Send actual avatar data
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
