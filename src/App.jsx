import { useEffect, useState } from 'react';
import { ChatWindow } from './components/chat/ChatWindow';
import { ContactList } from './components/contacts/ContactList';
import { AppLayout } from './components/layout/AppLayout';
import { Header } from './components/layout/Header';
import { AddContactModal } from './components/modals/AddContactModal';
import { UsernameModal } from './components/modals/UsernameModal';
import { Toast } from './components/shared/Toast';
import { useContacts } from './hooks/useContacts';
import { useP2P } from './hooks/useP2P';
import { profileDB } from './services/db';

function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [activeContact, setActiveContact] = useState(null);
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showChat, setShowChat] = useState(false);

  // Custom hooks
  const { connected, connectToRoom } = useP2P(profile);
  const { contacts, addContactByRoom, refreshContacts } = useContacts();

  useEffect(() => {
    initializeApp();

    // Handle resize
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Refresh contacts when P2P connects
  useEffect(() => {
    if (connected) {
      refreshContacts();

      // Refresh every 5 seconds while connected
      const interval = setInterval(refreshContacts, 5000);
      return () => clearInterval(interval);
    }
  }, [connected]);

  const initializeApp = async () => {
    const existingProfile = await profileDB.get();

    if (existingProfile) {
      setProfile(existingProfile);
    }

    setLoading(false);
  };

  const handleCreateProfile = async (displayName, username) => {
    const newProfile = await profileDB.create(displayName, username);
    setProfile(newProfile);

    if (username) {
      showToast(`Welcome to AirChat, @${username}! 🎉`, 'success');
    } else {
      showToast('Welcome to AirChat! 🎉', 'success');
    }
  };

  const handleAddContact = async (roomId) => {
    try {
      // Connect to their room
      await connectToRoom(roomId, roomId);

      setShowAddContact(false);
      showToast('Connecting to room...', 'success');

      // Refresh contacts after a delay to allow handshake
      setTimeout(() => {
        refreshContacts();
      }, 2000);
    } catch (error) {
      console.error('Failed to add contact:', error);
      showToast('Failed to connect to room', 'error');
    }
  };

  const handleContactSelect = (contact) => {
    setActiveContact(contact);
    if (isMobile) {
      setShowChat(true);
    }
  };

  const handleBackToContacts = () => {
    setShowChat(false);
    setActiveContact(null);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>💬</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>AirChat</h2>
          <p style={{ margin: 0, opacity: 0.9 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <>
        <UsernameModal onSubmit={handleCreateProfile} />
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </>
    );
  }

  return (
    <AppLayout isMobile={isMobile}>
      <Header
        displayName={profile.displayName}
        username={profile.username}
        personalRoomId={profile.personalRoomId}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Contact List - Hidden on mobile when chat is open */}
        <div
          style={{
            width: isMobile ? '100%' : '400px',
            display: isMobile && showChat ? 'none' : 'flex',
            flexDirection: 'column',
          }}
        >
          <ContactList
            contacts={contacts}
            activeContactId={activeContact?.peerId}
            onContactSelect={handleContactSelect}
            onAddContact={() => setShowAddContact(true)}
          />
        </div>

        {/* Chat Window - Full screen on mobile, right side on desktop */}
        <div
          style={{
            flex: 1,
            display: !isMobile || showChat ? 'flex' : 'none',
            flexDirection: 'column',
          }}
        >
          <ChatWindow
            contact={activeContact}
            currentUserId={profile.id}
            onBack={handleBackToContacts}
          />
        </div>
      </div>

      {/* Modals */}
      {showAddContact && (
        <AddContactModal
          myPersonalRoomId={profile.personalRoomId}
          myUsername={profile.username}
          onAdd={handleAddContact}
          onClose={() => setShowAddContact(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AppLayout>
  );
}

export default App;
