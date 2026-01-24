import { useEffect, useState } from 'react';
import { contactsDB, messagesDB } from '../../services/db';
import { ContactItem } from './ContactItem';

export const ContactList = ({
  contacts,
  activeContactId,
  onContactSelect,
  onAddContact,
}) => {
  const [unreadCounts, setUnreadCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContacts, setFilteredContacts] = useState(contacts);

  useEffect(() => {
    loadUnreadCounts();
  }, [contacts]);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, contacts]);

  const loadUnreadCounts = async () => {
    const counts = {};
    for (const contact of contacts) {
      counts[contact.peerId] = await messagesDB.getUnreadCount(contact.peerId);
    }
    setUnreadCounts(counts);
  };

  const filterContacts = async () => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const results = await contactsDB.search(searchQuery);
    setFilteredContacts(results);
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        borderRight: '1px solid #e4e6eb',
        position: 'relative',
      }}
    >
      {/* Header with Search */}
      <div
        style={{
          padding: '16px',
          background: '#f0f2f5',
          borderBottom: '1px solid #e4e6eb',
        }}
      >
        <h2
          style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#050505' }}
        >
          AirChat
        </h2>

        {/* Search Box */}
        <div style={{ position: 'relative' }}>
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search contacts...'
            style={{
              width: '100%',
              padding: '10px 16px 10px 40px',
              border: '1px solid #e4e6eb',
              borderRadius: '8px',
              fontSize: '15px',
              outline: 'none',
              background: 'white',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#25d366')}
            onBlur={(e) => (e.target.style.borderColor = '#e4e6eb')}
          />
          <span
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: '#8696a0',
            }}
          >
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#8696a0',
                padding: '4px 8px',
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Contact List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {filteredContacts.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: '#8696a0',
            }}
          >
            {searchQuery ? (
              <>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>🔍</p>
                <p style={{ margin: 0, fontSize: '16px' }}>No contacts found</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                  Try a different search term
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>💬</p>
                <p style={{ margin: 0, fontSize: '16px' }}>No contacts yet</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                  Tap the + button to add someone
                </p>
              </>
            )}
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <ContactItem
              key={contact.peerId}
              contact={contact}
              isActive={contact.peerId === activeContactId}
              unreadCount={unreadCounts[contact.peerId] || 0}
              onClick={() => onContactSelect(contact)}
            />
          ))
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={onAddContact}
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          background: '#25d366',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(37, 211, 102, 0.4)',
          transition: 'all 0.2s',
          zIndex: 10,
        }}
        onMouseOver={(e) => {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.boxShadow = '0 6px 16px rgba(37, 211, 102, 0.5)';
        }}
        onMouseOut={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.4)';
        }}
        title='Add Contact'
      >
        +
      </button>
    </div>
  );
};
