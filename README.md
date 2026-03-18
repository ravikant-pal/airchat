# 💬 AirChat — Serverless P2P Chat

AirChat is a **fully peer-to-peer chat application** built with **React**, **Nostr**, and **WebRTC**.

There is **no backend server you own or pay for.** Messages are delivered directly between peers — or held by free public Nostr relays until the recipient comes online.

> This started as a WhatsApp-inspired UI experiment. It is not a full WhatsApp clone — no voice calls, no groups, no stories. But it proves one thing: two people on different networks can exchange messages reliably, even when both are offline at the same time.

---

## ✨ What works

- **True P2P messaging** — WebRTC data channel when both peers are online, zero relay traffic
- **Async offline delivery** — messages published to Nostr relay when peer is offline, delivered on reconnect
- **Both-offline scenario** — B sends while offline, A receives even if B never comes back online
- **End-to-end encrypted DMs** — NIP-04 encrypted Nostr events, relay sees only ciphertext
- **Permanent identity** — Nostr keypair generated once, stored in `localStorage`, never changes
- **Media & file transfer** — photos and files sent over WebRTC data channel
- **Message receipts** — sent, delivered, seen — without a backend
- **Offline-first** — all messages and contacts stored locally in IndexedDB via Dexie
- **Auto-reconnect** — exponential backoff, resumes pending messages on reconnect
- **Contact requests** — cryptographic handshake via Nostr DM, accepted/rejected by recipient

---

## 🏗️ Architecture

### The core insight

> The Nostr relay is not a database. It is a post office — it holds your letter until the recipient opens their mailbox. Your actual data lives on your device.

```
ONLINE PATH (both peers connected)
  WebRTC data channel — direct P2P, no relay involved after handshake

OFFLINE PATH (recipient is offline)
  Nostr DM → relay stores encrypted event → recipient fetches on reconnect

BOTH OFFLINE PATH
  Sender publishes to Nostr relay → relay holds it
  Recipient subscribes on next open → relay delivers → done
  Neither peer needs to be online at the same time
```

### Signaling flow

```
1. Sender opens app       → Nostr keypair loaded from localStorage
2. Sender queries relay   → relay:connect fires (relayReady resolves)
3. Sender publishes offer → encrypted Nostr DM (kind: 4) to recipient pubkey
4. Recipient receives     → decrypts offer → sends WebRTC answer via Nostr DM
5. Google STUN            → both peers discover their public IP
6. WebRTC hole punch      → direct P2P connection established
7. Nostr relay            → completely out of the picture until next reconnect
```

### Identity model

| Concept   | Description                                                      |
| --------- | ---------------------------------------------------------------- |
| `pubKey`  | Nostr hex public key — permanent identity, shareable             |
| `privKey` | Nostr private key — stored in `localStorage`, never sent         |
| Contact   | Stored by `pubKey` in IndexedDB                                  |
| Messages  | Stored locally in IndexedDB, delivered via WebRTC or Nostr relay |

Peer identity never changes. Sharing your public key is how contacts add each other — no usernames, no servers, no lookup.

---

## 🧱 Tech stack

| Layer           | Technology                          | Cost   |
| --------------- | ----------------------------------- | ------ |
| Signaling       | Nostr public relays (damus, primal) | Free   |
| P2P transport   | WebRTC (browser-native)             | Free   |
| NAT traversal   | Google STUN                         | Free   |
| Offline storage | Dexie + IndexedDB                   | Free   |
| Media cache     | Cache Storage API                   | Free   |
| Identity        | Nostr keypair (local only)          | Free   |
| UI              | React + MUI                         | Free   |
| **Total**       |                                     | **₹0** |

---

## 📂 Project structure

```
src/
├── contexts/
│   └── NostrContext.jsx      # init once, exposes useNostr() hook
│
├── services/
│   ├── nostrService.js       # Nostr + WebRTC — all peer logic
│   ├── db.js                 # Dexie schema (IndexedDB)
│   └── cacheService.js       # Cache Storage for avatars & media
│
├── components/
│   ├── chat/
│   │   ├── ChatWindow.jsx
│   │   ├── ChatHeader.jsx
│   │   ├── ChatInput.jsx
│   │   ├── MessageList.jsx
│   │   └── MessageBubble.jsx
│   ├── contacts/
│   │   ├── ChatList.jsx
│   │   ├── ChatListItem.jsx
│   │   └── AddContactButton.jsx
│   ├── modals/
│   │   ├── AddContactModal.jsx
│   │   ├── ContactRequestDialog.jsx
│   │   └── ProfileDialog.jsx
│   └── header/
│       └── AppHeader.jsx
│
└── layout/
    ├── App.jsx               # thin layout shell, reads from NostrContext
    └── AppShell.jsx          # responsive split-pane layout
```

---

## 🗄️ Database schema

```js
db.version(3).stores({
  profile: '&peerId, &username, name, avatarKey',
  contacts:
    'peerId, name, online, lastSeen, connectionStatus, isAccepted, isTyping',
  messages:
    '&id, peerId, [peerId+status], sender, content, timestamp, type, status',
  pendingRequests: '&peerId, timestamp, direction, profile',
  typing: '&peerId, isTyping',
});
```

Messages with `status: 'created'` are unsent — they are flushed to the peer when the data channel opens.

---

## 🧪 Running locally

```bash
npm install
npm run dev
```

Open in two different browsers or devices. Copy your public key from the profile dialog and paste it into the other browser's "Add Contact" modal to initiate a connection.

---

## ⚠️ Known limitations

- **~20% of connections fail hole punching** when both peers are behind symmetric NAT (common on mobile carriers). A TURN relay fallback is not yet implemented — those connections currently fall back to Nostr DM only.
- **Relay retention** — Nostr relays are not guaranteed to store events forever. Most retain events for days to weeks. Long offline periods may result in missed messages.
- **No group chat** — architecture is 1:1 only.
- **No push notifications** — app must be open to receive messages in real time.
- **UX is a work in progress** — the networking architecture is proven; polish is ongoing.

---

## 🛣️ Roadmap

- TURN relay fallback for symmetric NAT (~20% of mobile connections)
- Push notifications via Web Push API
- Group chats
- Message search
- QR code contact sharing

---

## 📜 License

MIT
