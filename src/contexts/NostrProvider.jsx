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
import { registerPushNotifications } from '../services/notificationService';

const NostrContext = createContext(null);

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function fireNotification(title, body, tag) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  new Notification(title, {
    body,
    icon: '/airchat/web-app-manifest-192x192.png',
    badge: '/airchat/favicon-96x96.png',
    tag,
    renotify: true,
  });
}

export function NostrProvider({ children }) {
  const [activePeer, setActivePeer] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);

  const activePeerRef = useRef(null);
  const retryTimers = useRef(new Map());
  const retryAttempts = useRef(new Map());
  const isInitialized = useRef(false);

  const myProfile = useLiveQuery(() => db.profile.toCollection().first());

  useEffect(() => {
    activePeerRef.current = activePeer;
  }, [activePeer]);

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

  // Expose setActivePeer so sw message handler in App.jsx can call it
  // We store it on nostrService just as a side-channel — clean alternative
  // is to lift state but that would require bigger refactor
  const setActivePeerRef = useRef(null);
  useEffect(() => {
    setActivePeerRef.current = setActivePeer;
  }, [setActivePeer]);

  useEffect(() => {
    if (!myProfile?.peerId) return;
    if (isInitialized.current) return;
    isInitialized.current = true;

    // ── 1. Init nostrService ──────────────────────────────────────────────
    nostrService.init(myProfile.peerId);

    // ── 2. Request permission + register Web Push ─────────────────────────
    requestNotificationPermission().then((granted) => {
      if (granted) registerPushNotifications(myProfile.peerId);
    });

    // ── 3. Message + file handler ─────────────────────────────────────────
    nostrService.onMessage(async (fromPeer, data) => {
      try {
        if (data.type === 'message') {
          const exists = await db.messages.where('id').equals(data.id).first();
          if (exists) return;

          const isOpen = activePeerRef.current === fromPeer && !document.hidden;
          const status = isOpen ? 'seen' : 'delivered';

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

          if (!isOpen) {
            const contact = await db.contacts.get(fromPeer);
            const name = contact?.name || 'Someone';
            fireNotification(
              'AirChat',
              `${name}: ${data.text?.slice(0, 60)}`,
              fromPeer
            );
          }
        }

        if (data.type === 'file') {
          const exists = await db.messages.where('id').equals(data.id).first();
          if (exists) return;

          const isOpen = activePeerRef.current === fromPeer && !document.hidden;
          const status = isOpen ? 'seen' : 'delivered';

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

          if (!isOpen) {
            const contact = await db.contacts.get(fromPeer);
            const name = contact?.name || 'Someone';
            fireNotification(
              'AirChat',
              `${name} sent a file: ${data.fileName}`,
              fromPeer
            );
          }
        }

        if (data.type === 'typing') {
          await db.contacts.update(fromPeer, { isTyping: data.isTyping });
        }
      } catch (e) {
        console.error('[app] onMessage error:', e);
      }
    });

    // ── 4. Status handler ─────────────────────────────────────────────────
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

    // ── 5. Contact request handler ────────────────────────────────────────
    nostrService.onContactRequest((peerId, data) => {
      const name = data.profile?.name || data.profile?.username || 'Someone';
      setPendingRequest({ peerId, name });
      fireNotification(
        'AirChat',
        `${name} wants to connect with you`,
        `req_${peerId}`
      );
    });

    // ── 6. Contact accepted ───────────────────────────────────────────────
    nostrService.onContactAccepted((peerId) => {
      retryAttempts.current.set(peerId, 0);
    });

    // ── 7. Peer online ────────────────────────────────────────────────────
    nostrService.onPeerOnline(async (peerId) => {
      const t = retryTimers.current.get(peerId);
      if (t) {
        clearTimeout(t);
        retryTimers.current.delete(peerId);
      }
      retryAttempts.current.set(peerId, 0);
    });

    // ── 8. Peer offline ───────────────────────────────────────────────────
    nostrService.onPeerOffline(async (peerId) => {
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

    // ── 9. Auto-connect to accepted contacts ──────────────────────────────
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

    // ── 10. Re-sync when tab becomes visible ──────────────────────────────
    const handleVisibilityChange = async () => {
      if (document.hidden) return;
      console.log('[app] tab visible — re-syncing');
      nostrService._subscribe();
      const contacts = await db.contacts
        .filter((c) => c.isAccepted === true)
        .toArray();
      for (const contact of contacts) {
        if (!nostrService.isConnected(contact.peerId))
          attemptReconnect(contact);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── 11. Manual reconnect for ChatHeader ───────────────────────────────
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      retryTimers.current.forEach((t) => clearTimeout(t));
      retryTimers.current.clear();
      delete window.manualReconnect;
    };
  }, [myProfile?.peerId, attemptReconnect]);

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
