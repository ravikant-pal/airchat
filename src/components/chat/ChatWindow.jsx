import { Box, Typography, useMediaQuery } from '@mui/material';
import { useEffect, useRef } from 'react';
import { db } from '../../services/db';
import { peerService } from '../../services/peerService';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';

export function ChatWindow({ peerId, onBack }) {
  const isMobile = useMediaQuery('(max-width:768px)');
  const isWindowActive = useRef(true);

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
      isWindowActive.current = !document.hidden;

      // Mark messages as seen when window becomes active
      if (isWindowActive.current && peerId) {
        markMessagesAsSeen();
      }
    };

    const handleFocus = () => {
      isWindowActive.current = true;
      if (peerId) {
        markMessagesAsSeen();
      }
    };

    const handleBlur = () => {
      isWindowActive.current = false;
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
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [peerId]);

  useEffect(() => {
    // Handle incoming messages and files
    const handleMessage = async (fromPeer, data) => {
      console.log('fromPeer', fromPeer, 'data', data);

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

          // Determine initial status based on platform and active window
          let initialStatus = 'delivered';

          // On mobile: only mark as seen if this is the active chat
          // On desktop: mark as seen if window is focused and this is the active chat
          const shouldMarkAsSeen = isMobile
            ? peerId === fromPeer
            : peerId === fromPeer && isWindowActive.current;

          if (shouldMarkAsSeen) {
            initialStatus = 'seen';
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

          const shouldMarkAsSeen = isMobile
            ? peerId === fromPeer
            : peerId === fromPeer && isWindowActive.current;

          if (shouldMarkAsSeen) {
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
    };

    // Handle status updates
    const handleStatus = async (fromPeer, data) => {
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
    };

    peerService.onMessage(handleMessage);
    peerService.onStatus(handleStatus);

    // Cleanup
    return () => {
      // Optional: cleanup if needed
    };
  }, [peerId, isMobile]);

  if (!peerId) {
    return (
      <Box
        height='100%'
        display='flex'
        alignItems='center'
        justifyContent='center'
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
