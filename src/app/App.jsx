import { ChatWindow } from '../components/chat/ChatWindow';
import { ChatList } from '../components/contacts/ChatList';
import { ContactRequestDialog } from '../components/modals/ContactRequestDialog';
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
