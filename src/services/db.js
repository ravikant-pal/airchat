import Dexie from 'dexie';

// Database schema
export const db = new Dexie('AirChatDB');

db.version(1).stores({
  profile: 'id, displayName, username, personalRoomId, createdAt',
  rooms: 'roomId, name, joinedAt, isPersonal',
  contacts:
    '++id, [peerId+roomId], displayName, username, roomId, lastSeen, isOnline, addedAt',
  messages:
    '++id, messageId, roomId, peerId, content, type, timestamp, sent, delivered, read',
  settings: 'key, value',
});
// Profile operations
export const profileDB = {
  async get() {
    return await db.profile.toArray().then((profiles) => profiles[0]);
  },

  async create(displayName, username) {
    const profile = {
      id: 'user',
      displayName,
      username: username || null,
      personalRoomId: username
        ? generateRoomId(username)
        : generateRandomRoomId(),
      createdAt: Date.now(),
    };
    await db.profile.add(profile);
    return profile;
  },

  async update(data) {
    await db.profile.update('user', data);
  },
};

// Room operations
export const roomsDB = {
  async getAll() {
    return await db.rooms.orderBy('joinedAt').reverse().toArray();
  },

  async get(roomId) {
    return await db.rooms.get(roomId);
  },

  async add(room) {
    await db.rooms.put({
      roomId: room.roomId,
      name: room.name || room.roomId,
      joinedAt: Date.now(),
      isPersonal: room.isPersonal || false,
    });
  },

  async delete(roomId) {
    await db.rooms.delete(roomId);
  },
};

// Contact operations
export const contactsDB = {
  async getAll() {
    return await db.contacts.orderBy('lastSeen').reverse().toArray();
  },
  async getByRoomId(roomId) {
    return await db.contacts.where('roomId').equals(roomId).first();
  },

  async get(peerId) {
    return await db.contacts.get(peerId);
  },

  async search(query) {
    const allContacts = await db.contacts.toArray();
    const lowerQuery = query.toLowerCase();
    return allContacts.filter(
      (contact) =>
        contact.displayName?.toLowerCase().includes(lowerQuery) ||
        contact.username?.toLowerCase().includes(lowerQuery),
    );
  },

  async add(contact) {
    await db.contacts.put({
      peerId: contact.peerId,
      displayName:
        contact.displayName ||
        contact.username ||
        contact.peerId.substring(0, 8),
      username: contact.username || null,
      roomId: contact.roomId,
      lastSeen: Date.now(),
      isOnline: true,
      addedAt: Date.now(),
    });
  },

  async updateStatus(peerId, isOnline) {
    await db.contacts.update(peerId, {
      isOnline,
      lastSeen: Date.now(),
    });
  },

  async updateInfo(roomId, info) {
    await db.contacts.update(roomId, info);
  },

  async delete(peerId) {
    await db.contacts.delete(peerId);
  },
};

// Message operations
export const messagesDB = {
  async getByRoom(roomId) {
    return await db.messages.where('roomId').equals(roomId).sortBy('timestamp');
  },

  async getByPeer(peerId) {
    return await db.messages.where('peerId').equals(peerId).sortBy('timestamp');
  },

  async add(message) {
    return await db.messages.add({
      messageId: message.messageId,
      roomId: message.roomId,
      peerId: message.peerId,
      content: message.content,
      type: message.type || 'text',
      timestamp: message.timestamp || Date.now(),
      sent: message.sent ?? false,
      delivered: message.delivered ?? false,
      read: message.read ?? false,
      isMine: message.isMine ?? false,
    });
  },

  async updateByMessageId(messageId, updates) {
    const msg = await db.messages.where('messageId').equals(messageId).first();

    if (!msg) return;

    await db.messages.update(msg.id, updates);
  },

  async getUnreadByRoom(roomId) {
    return await db.messages
      .where('roomId')
      .equals(roomId)
      .and((m) => !m.read && !m.isMine)
      .toArray();
  },

  async getUnreadCount(peerId) {
    return await db.messages
      .where('peerId')
      .equals(peerId)
      .and((msg) => !msg.read && !msg.isMine)
      .count();
  },

  async markAsRead(peerId) {
    const messages = await db.messages
      .where('peerId')
      .equals(peerId)
      .and((msg) => !msg.read && !msg.isMine)
      .toArray();

    for (const msg of messages) {
      await db.messages.update(msg.id, { read: true });
    }
  },
};

// Helper functions
function generateRoomId(username) {
  return `@${username.toLowerCase().replace(/\s+/g, '')}`;
}

function generateRandomRoomId() {
  return `room-${Math.random().toString(36).substring(2, 10)}`;
}

export default db;
