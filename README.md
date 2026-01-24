# 💬 AirChat — Peer-to-Peer Chat App

AirChat is a **fully peer-to-peer chat application** built with **React**, **Dexie (IndexedDB)**, and **Trystero (WebRTC)**.
There is **no backend server** for messages — peers discover each other and communicate directly using WebRTC.

> 🧠 Contacts are identified by **room IDs** (stable identity), not ephemeral peer IDs.

---

## ✨ Features

- 🔗 **True P2P messaging** (WebRTC via Trystero)
- 🧑‍🤝‍🧑 **Contact-based chats** using personal room IDs
- 📡 **Online / offline presence**
- 📩 **Message delivery & read receipts**
- 💾 **Offline-first** (IndexedDB via Dexie)
- 🖼️ **Text & image messages**
- 🔄 **Auto-reconnect with peer ID refresh**
- 🚫 **No backend / no server / no cloud**

---

## 🏗️ Architecture Overview

### Identity model

| Concept  | Description                        |
| -------- | ---------------------------------- |
| `roomId` | **Stable identity** (e.g. `@ravi`) |
| `peerId` | Temporary WebRTC connection ID     |
| Contact  | Stored by `roomId`                 |
| Messages | Stored locally in IndexedDB        |

> Peer IDs change on reconnect — contacts remain stable via `roomId`.

---

### P2P Flow

1. User connects to their **personal room**
2. When a peer joins:
   - Handshake is exchanged
   - Contact is created or updated

3. Messages are:
   - Saved locally
   - Sent via WebRTC
   - Acknowledged with delivery/read receipts

---

## 🧱 Tech Stack

- **Frontend**: React + Hooks
- **P2P / WebRTC**: [Trystero](https://github.com/dmotz/trystero)
- **Local Database**: Dexie (IndexedDB)
- **State**: React state + Dexie live queries

---

## 📂 Project Structure (simplified)

```
src/
├─ hooks/
│  ├─ useP2P.js          # P2P lifecycle & events
│  ├─ useContacts.js    # Contacts logic
│
├─ services/
│  ├─ db.js             # Dexie schema
│  ├─ p2p.js            # Trystero wrapper (singleton)
│
├─ components/
│  ├─ ChatWindow/
│  ├─ MessageList/
│  ├─ ChatInput/
│
└─ App.jsx
```

---

## 🗄️ Database Schema (IndexedDB)

```js
contacts: 'peerId, displayName, username, roomId, lastSeen, isOnline, addedAt';

messages: '++id, &messageId, roomId, peerId, content, type, timestamp, sent, delivered, read';
```

- `messageId` is a **network ID**
- `id` is the **local DB primary key**

---

## 🚧 Development Notes

- React Fast Refresh can create **duplicate WebRTC connections**
- This project includes:
  - Connection locks
  - Room deduplication
  - Cleanup on unmount

- Designed to be **safe in dev & production**

---

## 🧪 Running Locally

```bash
npm install
npm run dev
```

Open in **two different browsers or devices** to test P2P messaging.

---

## 🛣️ Roadmap

- 🔐 End-to-end encryption
- 👥 Group chats
- 🔔 Push notifications
- 📱 Mobile UI optimizations
- 🌍 Room discovery / invites

---

## 🤝 Contributing

PRs, issues, and ideas are welcome.
This project is an experiment in **serverless real-time communication**.

---

## 📜 License

MIT
