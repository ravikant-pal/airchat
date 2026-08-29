import { Box } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../services/db';
import EmptyState from '../utils/EmptyState';
import { MessageBubble } from './MessageBubble';

export function MessageList({ peerId, messages: overrideMessages }) {
  const liveMessages = useLiveQuery(
    () =>
      peerId
        ? db.messages.where('peerId').equals(peerId).sortBy('timestamp')
        : [],
    [peerId],
  );

  // `messages` (in-memory, e.g. Random Connect) takes precedence over the
  // persisted IndexedDB history used by private chats.
  const messages = overrideMessages ?? liveMessages;

  const hasMessages = messages && messages.length > 0;

  return (
    <Box
      flex={1}
      overflow='auto'
      px={1}
      py={2}
      display='flex'
      flexDirection='column'
      sx={{
        backgroundImage:
          'url("https://www.transparenttextures.com/patterns/always-grey.png")',
      }}
    >
      {!peerId ? (
        <EmptyState text='Select a chat to start messaging 💬' />
      ) : !hasMessages ? (
        <EmptyState text='No messages yet. Say hello 👋' />
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}
    </Box>
  );
}
