import { Box, Typography, useMediaQuery } from '@mui/material';
import { useEffect } from 'react';
import { db } from '../../services/db';
import { peerService } from '../../services/peerService';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';

export function ChatWindow({ peerId, onBack }) {
  const isMobile = useMediaQuery('(max-width:768px)');

  useEffect(() => {
    // Mark all messages as seen when chat window opens
    const markMessagesAsSeen = async () => {
      if (!peerId) return;

      // Get all unread messages from this peer
      const unreadMessages = await db.messages
        .where('peerId')
        .equals(peerId)
        .and((msg) => msg.sender === 'peer' && msg.status !== 'seen')
        .toArray();

      // Update all to seen
      for (const msg of unreadMessages) {
        await db.messages.update(msg.id, { status: 'seen' });

        // Send seen status to peer
        peerService.send(peerId, {
          type: 'status',
          messageId: msg.id,
          status: 'seen',
        });
      }
    };

    markMessagesAsSeen();
  }, [peerId]);

  useEffect(() => {
    // Track if window is visible/focused (for desktop)
    const handleVisibilityChange = () => {
      // Mark messages as seen when window becomes active
      if (!document.hidden && peerId) {
        markMessagesAsSeen();
      }
    };

    const handleFocus = () => {
      if (peerId) {
        markMessagesAsSeen();
      }
    };

    const markMessagesAsSeen = async () => {
      if (!peerId) return;

      const unreadMessages = await db.messages
        .where('peerId')
        .equals(peerId)
        .and((msg) => msg.sender === 'peer' && msg.status !== 'seen')
        .toArray();

      for (const msg of unreadMessages) {
        await db.messages.update(msg.id, { status: 'seen' });

        peerService.send(peerId, {
          type: 'status',
          messageId: msg.id,
          status: 'seen',
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [peerId]);

  if (!peerId) {
    return (
      <Box
        display='flex'
        flexDirection='column'
        height='100dvh'
        overflow='hidden'
      >
        <Typography color='text.secondary'>
          Select a chat to start messaging
        </Typography>
      </Box>
    );
  }

  return (
    <Box display='flex' flexDirection='column' height='100%'>
      <ChatHeader peerId={peerId} onBack={onBack} />
      <MessageList peerId={peerId} />
      <ChatInput peerId={peerId} />
    </Box>
  );
}
