import { Box, List } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../../services/db';
import { AppHeader } from '../header/AppHeader';
import { AddContactButton } from './AddContactButton';
import { ChatListItem } from './ChatListItem';

export function ChatList({ onSelect, myProfile, toggleTheme, themeMode }) {
  const [search, setSearch] = useState('');

  // Get all contacts and messages in one query
  const contactsData = useLiveQuery(async () => {
    const contacts = await db.contacts.toArray();

    // Get last message for each contact
    const contactsWithMessages = await Promise.all(
      contacts.map(async (contact) => {
        const lastMessage = await db.messages
          .where('peerId')
          .equals(contact.peerId)
          .reverse()
          .sortBy('timestamp');

        return {
          ...contact,
          lastMessageTime: lastMessage[0]?.timestamp || 0,
        };
      }),
    );

    // Sort by last message time (most recent first)
    return contactsWithMessages.sort(
      (a, b) => b.lastMessageTime - a.lastMessageTime,
    );
  }, []);

  // Filter contacts based on search
  const filteredContacts = useMemo(() => {
    if (!contactsData) return [];
    if (!search) return contactsData;

    const q = search.toLowerCase();
    return contactsData.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.peerId?.toLowerCase().includes(q),
    );
  }, [contactsData, search]);

  const hasContacts = contactsData && contactsData.length > 0;
  const hasResults = filteredContacts && filteredContacts.length > 0;

  return (
    <Box position='relative' height='100%'>
      <AppHeader
        search={search}
        onSearch={(e) => setSearch(e.target.value)}
        toggleTheme={toggleTheme}
        themeMode={themeMode}
      />
      <List>
        {hasResults ? (
          filteredContacts.map((c) => (
            <ChatListItem
              key={c.peerId}
              peerId={c.peerId}
              name={c.name || `@${c.peerId}`}
              username={c.username}
              avatarKey={c.avatarKey}
              online={c.online}
              lastSeen={c.lastSeen}
              connectionStatus={c.connectionStatus}
              isAccepted={c.isAccepted}
              onClick={() => onSelect(c.peerId)}
            />
          ))
        ) : (
          <Box
            display='flex'
            alignItems='center'
            justifyContent='center'
            height='60vh'
            color='text.secondary'
            textAlign='center'
            px={3}
          >
            {hasContacts ? (
              <>No matches found 🔍</>
            ) : (
              <>
                No chats yet.
                <br />
                Add a new contact to start chatting 💬
              </>
            )}
          </Box>
        )}
      </List>

      {myProfile && <AddContactButton myProfile={myProfile} />}
    </Box>
  );
}
