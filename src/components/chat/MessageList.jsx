import { useEffect, useRef } from 'react';
import { ChatBubble } from './ChatBubble';

export const MessageList = ({ messages, currentUserId }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatDateDivider = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const groupMessagesByDate = (messages) => {
    const groups = [];
    let currentDate = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.timestamp).toDateString();
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({
          type: 'date',
          date: message.timestamp,
        });
      }
      groups.push({
        type: 'message',
        data: message,
      });
    });

    return groups;
  };

  const groupedItems = groupMessagesByDate(messages);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        background: '#efeae2',
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h100v100H0z' fill='%23efeae2'/%3E%3Cpath d='M20 20h60v60H20z' fill='none' stroke='%23d1d7db' stroke-width='0.5' opacity='0.1'/%3E%3C/svg%3E\")",
        padding: '12px 0',
      }}
    >
      {messages.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#667781',
            fontSize: '14px',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>💬</p>
            <p style={{ margin: 0 }}>No messages yet</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
              Send a message to start the conversation
            </p>
          </div>
        </div>
      ) : (
        <>
          {groupedItems.map((item, index) => {
            if (item.type === 'date') {
              return (
                <div
                  key={`date-${index}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '12px 0',
                  }}
                >
                  <div
                    style={{
                      background: 'white',
                      padding: '5px 12px',
                      borderRadius: '7.5px',
                      boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                      fontSize: '12.5px',
                      color: '#667781',
                    }}
                  >
                    {formatDateDivider(item.date)}
                  </div>
                </div>
              );
            } else {
              return (
                <ChatBubble
                  key={item.data.id || `msg-${index}`}
                  message={item.data}
                  isMine={item.data.isMine}
                />
              );
            }
          })}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
};
