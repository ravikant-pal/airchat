import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ChatList } from '../components/contacts/ChatList';

import { ContactRequestDialog } from '../components/modals/ContactRequestDialog';
import { db } from '../services/db';
import { peerService } from '../services/peerService';
import AppShell from './AppShell';

export default function App({ toggleTheme, themeMode }) {
  const [activePeer, setActivePeer] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const retryTimers = useRef(new Map());
  const retryAttempts = useRef(new Map());

  const myProfile = useLiveQuery(() => db.profile.toCollection().first());

  // Define attemptReconnect at the top level so it's accessible everywhere
  const attemptReconnect = async (contact) => {
    const peerId = contact.peerId;
    const currentAttempts = retryAttempts.current.get(peerId) || 0;
    const MAX_RETRIES = 5;

    if (currentAttempts >= MAX_RETRIES) {
      console.log(`Max retries reached for ${peerId}`);
      await db.contacts.update(peerId, {
        connectionStatus: 'failed',
        online: false,
      });
      return;
    }

    // Update status to connecting
    await db.contacts.update(peerId, {
      connectionStatus: 'connecting',
      online: false,
    });

    console.log(
      `Attempting to reconnect to ${peerId} (attempt ${currentAttempts + 1}/${MAX_RETRIES})`,
    );

    try {
      await peerService.connect(peerId);
      // If successful, reset retry count
      retryAttempts.current.set(peerId, 0);

      // Clear any pending timers
      const timer = retryTimers.current.get(peerId);
      if (timer) {
        clearTimeout(timer);
        retryTimers.current.delete(peerId);
      }
    } catch (error) {
      console.error(`Failed to connect to ${peerId}:`, error);

      // Increment retry count
      retryAttempts.current.set(peerId, currentAttempts + 1);

      // Schedule next retry with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, currentAttempts), 30000); // Max 30 seconds

      const timer = setTimeout(async () => {
        const c = await db.contacts.get(peerId);
        if (c?.isAccepted) {
          attemptReconnect(c);
        }
      }, retryDelay);

      retryTimers.current.set(peerId, timer);
    }
  };

  // Expose reconnect function globally for ChatHeader
  useEffect(() => {
    window.manualReconnect = async (peerId) => {
      // Clear existing retry attempts and timers
      const timer = retryTimers.current.get(peerId);
      if (timer) {
        clearTimeout(timer);
        retryTimers.current.delete(peerId);
      }

      // Reset retry count for manual reconnect
      retryAttempts.current.set(peerId, 0);

      const contact = await db.contacts.get(peerId);
      if (contact?.isAccepted) {
        await attemptReconnect(contact);
      }
    };

    return () => {
      delete window.manualReconnect;
    };
  }, []);

  // Auto-reconnect logic on mount
  useEffect(() => {
    if (!myProfile?.peerId) return;

    const startAutoReconnect = async () => {
      const acceptedContacts = await db.contacts
        .where('isAccepted')
        .equals(1)
        .toArray();

      for (const contact of acceptedContacts) {
        // Skip if already connected
        if (peerService.connections.has(contact.peerId)) {
          await db.contacts.update(contact.peerId, {
            connectionStatus: 'connected',
            online: true,
          });
          continue;
        }

        // Start reconnection attempts
        attemptReconnect(contact);
      }
    };

    startAutoReconnect();

    // Cleanup timers on unmount
    return () => {
      retryTimers.current.forEach((timer) => clearTimeout(timer));
      retryTimers.current.clear();
    };
  }, [myProfile?.peerId]);

  useEffect(() => {
    if (!myProfile?.peerId) return;

    peerService.init(myProfile.peerId);

    peerService.onContactRequest((peerId, data) => {
      setPendingRequest({
        peerId,
        name: data.profile?.name || data.profile?.username,
      });
    });

    peerService.onContactAccepted(async (peerId, profile) => {
      console.log('Contact accepted:', peerId, profile);
      // Reset retry attempts for this peer
      retryAttempts.current.set(peerId, 0);
    });

    peerService.onPeerOnline(async (peerId) => {
      console.log('Peer online:', peerId);

      // Clear any pending retry timers
      const timer = retryTimers.current.get(peerId);
      if (timer) {
        clearTimeout(timer);
        retryTimers.current.delete(peerId);
      }

      // Reset retry count
      retryAttempts.current.set(peerId, 0);

      await db.contacts.update(peerId, {
        online: true,
        connectionStatus: 'connected',
        lastSeen: null,
      });
    });

    peerService.onPeerOffline(async (peerId) => {
      console.log('Peer offline:', peerId);

      await db.contacts.update(peerId, {
        online: false,
        connectionStatus: 'disconnected',
        lastSeen: Date.now(),
      });

      // Attempt to reconnect after a delay
      const contact = await db.contacts.get(peerId);
      if (contact?.isAccepted) {
        retryAttempts.current.set(peerId, 0); // Reset on disconnect

        // Clear any existing timer
        const existingTimer = retryTimers.current.get(peerId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
          const c = await db.contacts.get(peerId);
          if (c?.isAccepted) {
            attemptReconnect(c);
          }
        }, 5000); // Wait 5 seconds before first retry

        retryTimers.current.set(peerId, timer);
      }
    });
  }, [myProfile?.peerId]);

  const handleAcceptRequest = async (peerId) => {
    await peerService.acceptContactRequest(peerId, myProfile);
    setPendingRequest(null);
  };

  const handleRejectRequest = async (peerId) => {
    await peerService.rejectContactRequest(peerId);
    setPendingRequest(null);
  };

  return (
    <>
      <AppShell
        showChat={!!activePeer}
        chatList={
          <ChatList
            onSelect={setActivePeer}
            myProfile={myProfile}
            toggleTheme={toggleTheme}
            themeMode={themeMode}
          />
        }
        chatWindow={
          activePeer && (
            <ChatWindow
              peerId={activePeer}
              onBack={() => setActivePeer(null)}
            />
          )
        }
      />

      <ContactRequestDialog
        request={pendingRequest}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
      />
    </>
  );
}
