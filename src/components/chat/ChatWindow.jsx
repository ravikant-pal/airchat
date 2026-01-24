import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { messagesDB } from '../../services/db';
import { p2pService } from '../../services/p2p';
import { Avatar } from '../shared/Avatar';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';

export const ChatWindow = ({ contact, currentUserId, onBack }) => {
  const [isTyping, setIsTyping] = useState(false);
  const messages = useLiveQuery(
    () => (contact ? messagesDB.getByRoom(contact.roomId) : []),
    [contact?.roomId],
  );

  useEffect(() => {
    markAsRead();
  }, [contact?.roomId]);

  const markAsRead = async () => {
    if (!contact) return;

    const unread = await messagesDB.getUnreadByRoom(contact.roomId);

    for (const msg of unread) {
      await messagesDB.updateByMessageId(msg.messageId, { read: true });

      p2pService.actions.get(contact.roomId)?.sendReceipt({
        messageId: msg.messageId,
        status: 'read',
      });
    }
  };

  const base64ToBlob = (base64, type) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type });
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSendMessage = async ({ content, type, file }) => {
    if (!contact) return;

    let messageContent = content;
    let imageData = null;
    const messageId = crypto.randomUUID();

    // Process image if present
    if (type === 'image' && file) {
      try {
        const base64 = await blobToBase64(file);
        imageData = {
          data: base64,
          type: file.type,
          name: file.name,
          size: file.size,
        };
        messageContent = JSON.stringify(imageData);
      } catch (error) {
        console.error('Error processing image:', error);
        return;
      }
    }

    // Save to local DB
    const message = {
      messageId,
      peerId: contact.peerId,
      roomId: contact.roomId,
      content: messageContent,
      type,
      timestamp: Date.now(),
      isMine: true,
      sent: false,
      delivered: false,
      read: false,
    };

    const msgId = await messagesDB.add(message);

    // Send via P2P
    p2pService.sendMessage(contact.roomId, {
      type: 'message',
      messageId,
      content: messageContent,
      messageType: type,
      timestamp: message.timestamp,
    });

    // Update sent status
    await messagesDB.updateByMessageId(msgId, { sent: true });

    // Reload messages
  };

  if (!contact) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
          color: '#667781',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '64px', margin: '0 0 16px 0' }}>💬</p>
          <h2
            style={{ margin: '0 0 8px 0', fontSize: '32px', color: '#41525d' }}
          >
            AirChat
          </h2>
          <p style={{ margin: 0, fontSize: '14px' }}>
            Select a contact to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 16px',
          background: '#f0f2f5',
          borderBottom: '1px solid #e4e6eb',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Back button (mobile only) */}
        <button
          onClick={onBack}
          style={{
            display: 'none',
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px',
            color: '#54656f',
          }}
          className='mobile-back-btn'
        >
          ←
        </button>

        <Avatar
          name={contact.displayName}
          size={40}
          online={contact.isOnline}
        />

        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '500',
              color: '#111b21',
            }}
          >
            {contact.displayName}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: '#667781',
            }}
          >
            {contact.isOnline
              ? 'online'
              : `last seen ${new Date(contact.lastSeen).toLocaleString()}`}
          </p>
        </div>

        {/* More options button */}
        {/* <button
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px',
            color: '#54656f',
          }}
        >
          ⋮
        </button> */}
      </div>

      {/* Messages */}
      <MessageList messages={messages} currentUserId={currentUserId} />

      {/* Typing indicator */}
      {isTyping && (
        <div
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            color: '#667781',
            fontStyle: 'italic',
          }}
        >
          Typing...
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSendMessage} disabled={!contact.isOnline} />
    </div>
  );
};
