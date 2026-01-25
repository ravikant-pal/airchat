import Dexie from 'dexie';

export const db = new Dexie('airchat');

db.version(1).stores({
  profile: '&peerId, &username, name, avatarKey',
  contacts: 'peerId, name, online, lastSeen, connectionStatus, isAccepted',
  messages:
    '&id, peerId, [peerId+status], sender, content, timestamp, type, status',
  typing: 'peerId, isTyping',
  pendingRequests: '&peerId, timestamp, direction, profile',
});
