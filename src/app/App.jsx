import { useEffect, useState } from 'react';
import { ChatWindow } from '../components/chat/ChatWindow';
import { ChatList } from '../components/contacts/ChatList';
import { ContactRequestDialog } from '../components/modals/ContactRequestDialog';
import RandomScreen from '../components/random/RandomScreen';
import { RandomConnectProvider } from '../contexts/RandomConnectProvider';
import { useNostr } from '../contexts/NostrProvider';
import AppShell from './AppShell';

export default function App({ toggleTheme, themeMode }) {
  const {
    activePeer,
    setActivePeer,
    pendingRequest,
    handleAcceptRequest,
    handleRejectRequest,
    myProfile,
  } = useNostr();

  // 'private' = persistent/vetted contacts · 'random' = anonymous connections
  const [chatMode, setChatMode] = useState('private');

  useEffect(() => {
    // Handle notification tap when app was ALREADY OPEN (minimized)
    // SW sends a postMessage → we open the right chat
    const handleSWMessage = (event) => {
      if (event.data?.type === 'OPEN_CHAT') {
        setChatMode('private');
        setActivePeer(event.data.pubkey);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    // Handle notification tap when app was FULLY CLOSED
    // SW opens /airchat/?chat=pubkey → we read the param here
    const params = new URLSearchParams(window.location.search);
    const chatPubkey = params.get('chat');
    if (chatPubkey) {
      setActivePeer(chatPubkey);
      // Clean up URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [setActivePeer]);

  if (chatMode === 'random') {
    return (
      <>
        <RandomConnectProvider>
          <RandomScreen onBackToChats={() => setChatMode('private')} />
        </RandomConnectProvider>
        <ContactRequestDialog
          request={pendingRequest}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
        />
      </>
    );
  }

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
            onEnterRandom={() => setChatMode('random')}
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
