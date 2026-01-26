import Dexie from 'dexie';

export const db = new Dexie('airchat');

db.version(2).stores({
  profile: '&peerId, &username, name, avatarKey',
  contacts:
    'peerId, name, online, lastSeen, connectionStatus, isAccepted, isTyping',
  messages:
    '&id, peerId, [peerId+status], sender, content, timestamp, type, status',
  pendingRequests: '&peerId, timestamp, direction, profile',
});
