/**
 * NostrContext.jsx
 *
 * Single source of truth for all peer/nostr state.
 * Wrap your app in <NostrProvider> once — nostrService.init() is called
 * exactly once per page load, never on navigation.
 *
 * Usage:
 *   const { activePeer, setActivePeer, pendingRequest,
 *           handleAcceptRequest, handleRejectRequest } = useNostr()
 */

import { useLiveQuery } from 'dexie-react-hooks';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { db } from '../services/db';
import { nostrService } from '../services/nostrService';

const NostrContext = createContext(null);

export function NostrProvider({ children }) {
  const [activePeer, setActivePeer] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);

  // Ref mirrors activePeer so event callbacks always read the current value
  // without being recreated (which would re-run init)
  const activePeerRef = useRef(null);
  const retryTimers = useRef(new Map());
  const retryAttempts = useRef(new Map());
  const isInitialized = useRef(false); // hard guard — init() runs exactly once

  const myProfile = useLiveQuery(() => db.profile.toCollection().first());

  // Keep ref in sync on every render
  useEffect(() => {
    activePeerRef.current = activePeer;
  }, [activePeer]);

  // ─── Reconnect helpers ────────────────────────────────────────────────────

  const attemptReconnect = useCallback(async (contact) => {
    const peerId = contact.peerId;
    const attempts = retryAttempts.current.get(peerId) || 0;
    const MAX = 5;

    if (attempts >= MAX) {
      await db.contacts.update(peerId, {
        connectionStatus: 'failed',
        online: false,
      });
      return;
    }

    await db.contacts.update(peerId, {
      connectionStatus: 'connecting',
      online: false,
    });
    console.log(
      `[app] reconnect ${peerId.slice(0, 8)} attempt ${attempts + 1}/${MAX}`
    );

    try {
      await nostrService.connect(peerId);
      retryAttempts.current.set(peerId, 0);
      const t = retryTimers.current.get(peerId);
      if (t) {
        clearTimeout(t);
        retryTimers.current.delete(peerId);
      }
    } catch (err) {
      console.error(`[app] reconnect failed for ${peerId.slice(0, 8)}:`, err);
      retryAttempts.current.set(peerId, attempts + 1);
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      const t = setTimeout(async () => {
        const c = await db.contacts.get(peerId);
        if (c?.isAccepted) attemptReconnect(c);
      }, delay);
      retryTimers.current.set(peerId, t);
    }
  }, []);

  // ─── One-time init ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!myProfile?.peerId) return;
    if (isInitialized.current) return; // already running — skip on re-renders
    isInitialized.current = true;

    // ── 1. Init nostrService (connects to relays, starts subscription) ──────
    nostrService.init(myProfile.peerId);

    // ── 2. Register all event callbacks ──────────────────────────────────────

    nostrService.onMessage(async (fromPeer, data) => {
      try {
        if (data.type === 'message') {
          const exists = await db.messages.where('id').equals(data.id).first();
          if (exists) return;

          const status =
            activePeerRef.current === fromPeer && !document.hidden
              ? 'seen'
              : 'delivered';

          await db.messages.put({
            id: data.id,
            peerId: fromPeer,
            sender: 'peer',
            content: data.text,
            timestamp: data.timestamp || Date.now(),
            status,
            type: 'text',
          });
          nostrService.send(fromPeer, {
            type: 'status',
            messageId: data.id,
            status,
          });
        }

        if (data.type === 'file') {
          const exists = await db.messages.where('id').equals(data.id).first();
          if (exists) return;

          const status =
            activePeerRef.current === fromPeer && !document.hidden
              ? 'seen'
              : 'delivered';

          await db.messages.put({
            id: data.id,
            peerId: fromPeer,
            sender: 'peer',
            content: data.fileName,
            timestamp: data.timestamp || Date.now(),
            status,
            type: 'file',
            file: data.fileBase64,
          });
          nostrService.send(fromPeer, {
            type: 'status',
            messageId: data.id,
            status,
          });
        }

        if (data.type === 'typing') {
          await db.contacts.update(fromPeer, { isTyping: data.isTyping });
        }
      } catch (e) {
        console.error('[app] onMessage error:', e);
      }
    });

    nostrService.onStatus(async (fromPeer, data) => {
      try {
        await db.messages
          .where('id')
          .equals(data.messageId)
          .modify({ status: data.status });
      } catch (e) {
        console.error('[app] onStatus error:', e);
      }
    });

    nostrService.onContactRequest((peerId, data) => {
      setPendingRequest({
        peerId,
        name: data.profile?.name || data.profile?.username,
      });
    });

    nostrService.onContactAccepted((peerId) => {
      retryAttempts.current.set(peerId, 0);
    });

    nostrService.onPeerOnline(async (peerId) => {
      const t = retryTimers.current.get(peerId);
      if (t) {
        clearTimeout(t);
        retryTimers.current.delete(peerId);
      }
      retryAttempts.current.set(peerId, 0);
      await db.contacts.update(peerId, {
        online: true,
        connectionStatus: 'connected',
        lastSeen: null,
      });
    });

    nostrService.onPeerOffline(async (peerId) => {
      await db.contacts.update(peerId, {
        online: false,
        connectionStatus: 'disconnected',
        lastSeen: Date.now(),
      });
      const contact = await db.contacts.get(peerId);
      if (!contact?.isAccepted) return;

      retryAttempts.current.set(peerId, 0);
      const existing = retryTimers.current.get(peerId);
      if (existing) clearTimeout(existing);

      const t = setTimeout(async () => {
        const c = await db.contacts.get(peerId);
        if (c?.isAccepted) attemptReconnect(c);
      }, 5000);
      retryTimers.current.set(peerId, t);
    });

    // ── 3. Auto-connect to accepted contacts after relay is ready ────────────
    // Staggered with a small delay so relay:connect fires first
    const autoConnectTimer = setTimeout(async () => {
      const contacts = await db.contacts
        .filter((c) => c.isAccepted === true)
        .toArray();
      console.log(`[app] auto-connecting to ${contacts.length} contacts`);
      for (const contact of contacts) {
        if (!nostrService.isConnected(contact.peerId)) {
          await db.contacts.update(contact.peerId, {
            connectionStatus: 'connecting',
            online: false,
          });
          attemptReconnect(contact);
        }
      }
    }, 1500);

    // ── 4. Expose manual reconnect for ChatHeader ─────────────────────────
    window.manualReconnect = async (peerId) => {
      const t = retryTimers.current.get(peerId);
      if (t) {
        clearTimeout(t);
        retryTimers.current.delete(peerId);
      }
      retryAttempts.current.set(peerId, 0);
      const contact = await db.contacts.get(peerId);
      if (contact?.isAccepted) await attemptReconnect(contact);
    };

    return () => {
      clearTimeout(autoConnectTimer);
      retryTimers.current.forEach((t) => clearTimeout(t));
      retryTimers.current.clear();
      delete window.manualReconnect;
    };
  }, [myProfile?.peerId]); // runs once when profile is first available

  // ─── Contact request handlers ─────────────────────────────────────────────

  const handleAcceptRequest = useCallback(
    async (peerId) => {
      await nostrService.acceptContactRequest(peerId, myProfile);
      setPendingRequest(null);
    },
    [myProfile]
  );

  const handleRejectRequest = useCallback(async (peerId) => {
    await nostrService.rejectContactRequest(peerId);
    setPendingRequest(null);
  }, []);

  return (
    <NostrContext.Provider
      value={{
        activePeer,
        setActivePeer,
        pendingRequest,
        handleAcceptRequest,
        handleRejectRequest,
        myProfile,
      }}
    >
      {children}
    </NostrContext.Provider>
  );
}

export function useNostr() {
  const ctx = useContext(NostrContext);
  if (!ctx) throw new Error('useNostr must be used inside <NostrProvider>');
  return ctx;
}
