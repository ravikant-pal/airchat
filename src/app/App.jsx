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

  // Auto-reconnect logic on mount - CRITICAL for handling page reloads
  useEffect(() => {
    if (!myProfile?.peerId) return;

    // Wait for peer to initialize before attempting connections
    const initTimeout = setTimeout(async () => {
      console.log('=== AUTO-RECONNECT: Starting ===');

      // FIXED: Use true (boolean) instead of 1 (number)
      const acceptedContacts = await db.contacts
        .filter((c) => c.isAccepted === true)
        .toArray();

      console.log(
        `Found ${acceptedContacts.length} accepted contacts to reconnect`,
      );
      console.log(
        'Accepted contacts:',
        acceptedContacts.map((c) => c.peerId),
      );

      for (const contact of acceptedContacts) {
        console.log(`Checking connection to ${contact.peerId}`);

        // Always attempt to connect on page load
        // The connections Map is EMPTY after reload, so we need to rebuild
        if (!peerService.connections.has(contact.peerId)) {
          console.log(
            `No existing connection to ${contact.peerId}, reconnecting...`,
          );

          // Mark as connecting
          await db.contacts.update(contact.peerId, {
            connectionStatus: 'connecting',
            online: false,
          });

          // Start reconnection attempts
          attemptReconnect(contact);
        } else {
          console.log(`Already connected to ${contact.peerId}`);
          await db.contacts.update(contact.peerId, {
            connectionStatus: 'connected',
            online: true,
          });
        }
      }
    }, 1000); // Wait 1 second for peer to initialize

    // Cleanup timers on unmount
    return () => {
      clearTimeout(initTimeout);
      retryTimers.current.forEach((timer) => clearTimeout(timer));
      retryTimers.current.clear();
    };
  }, [myProfile?.peerId]);

  useEffect(() => {
    if (!myProfile?.peerId) return;

    peerService.init(myProfile.peerId);

    // Register global message handlers (NOT dependent on ChatWindow being open)
    peerService.onMessage(async (fromPeer, data) => {
      console.log('App: Received message from', fromPeer, 'type:', data.type);

      try {
        if (data.type === 'message') {
          // Check if message already exists
          const existingMessage = await db.messages
            .where('id')
            .equals(data.id)
            .first();

          if (existingMessage) {
            console.log('Message already exists, skipping:', data.id);
            return;
          }

          // Determine initial status
          // Only mark as 'seen' if this chat is currently open
          let initialStatus = 'delivered';

          // Check if the chat window is open for this peer
          if (activePeer === fromPeer) {
            // Additional check: is window focused (for desktop)?
            if (!document.hidden) {
              initialStatus = 'seen';
            }
          }

          // Store the message
          await db.messages.put({
            peerId: fromPeer,
            sender: 'peer',
            content: data.text,
            timestamp: data.timestamp || Date.now(),
            status: initialStatus,
            type: 'text',
            id: data.id,
          });

          // Send appropriate status acknowledgment
          peerService.send(fromPeer, {
            type: 'status',
            messageId: data.id,
            status: initialStatus,
          });
        }

        if (data.type === 'file') {
          // Check if file message already exists
          const existingMessage = await db.messages
            .where('id')
            .equals(data.id)
            .first();

          if (existingMessage) {
            console.log('File message already exists, skipping:', data.id);
            return;
          }

          // Determine initial status
          let initialStatus = 'delivered';

          if (activePeer === fromPeer && !document.hidden) {
            initialStatus = 'seen';
          }

          // Store the file message
          await db.messages.put({
            peerId: fromPeer,
            sender: 'peer',
            content: data.fileName,
            timestamp: data.timestamp || Date.now(),
            status: initialStatus,
            type: 'file',
            file: data.fileBase64,
            id: data.id,
          });

          // Send appropriate status acknowledgment
          peerService.send(fromPeer, {
            type: 'status',
            messageId: data.id,
            status: initialStatus,
          });
        }

        if (data.type === 'typing') {
          await db.typing.put({ peerId: fromPeer, isTyping: data.isTyping });
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    // Handle status updates
    peerService.onStatus(async (fromPeer, data) => {
      console.log(
        'App: Status update from',
        fromPeer,
        data.messageId,
        data.status,
      );

      try {
        const updated = await db.messages
          .where('id')
          .equals(data.messageId)
          .modify({ status: data.status });

        if (updated === 0) {
          console.warn(
            'No message found to update status for:',
            data.messageId,
          );
        }
      } catch (error) {
        console.error('Error updating message status:', error);
      }
    });

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
  }, [myProfile?.peerId, activePeer]);

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
