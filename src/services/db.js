import Dexie from 'dexie';

export const db = new Dexie('airchat');

// Version 3: added typing table
// Note: peerId is now a Nostr hex pubkey (64 char hex string)
// Old UUID-based profiles will be auto-migrated by nostrService.init()
db.version(3).stores({
  profile: '&peerId, &username, name, avatarKey',
  contacts:
    'peerId, name, online, lastSeen, connectionStatus, isAccepted, isTyping',
  messages:
    '&id, peerId, [peerId+status], sender, content, timestamp, type, status',
  pendingRequests: '&peerId, timestamp, direction, profile',
  typing: '&peerId, isTyping',
});
