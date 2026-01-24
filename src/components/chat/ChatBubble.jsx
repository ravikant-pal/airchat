import './ChatBubble.css';

export const ChatBubble = ({ message, isMine }) => {
  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const getTickClass = () => {
    if (!message.sent) return 'pending';
    if (message.sent && !message.delivered) return 'sent';
    if (message.delivered && !message.read) return 'delivered';
    if (message.read) return 'read';
  };

  return (
    <div className={`bubble-row ${isMine ? 'mine' : ''}`}>
      <div className={`bubble ${isMine ? 'mine' : ''}`}>
        <div className='bubble-content'>{message.content}</div>

        <div className='bubble-meta'>
          <span className='time'>{formatTime(message.timestamp)}</span>

          {isMine && (
            <svg className={`tick ${getTickClass()}`} viewBox='2 6 20 12'>
              <path d='M3.96967 12.5303L7.96967 16.5303L9.03033 15.4697L5.03033 11.4697L3.96967 12.5303ZM9.03033 16.5303L17.0303 8.53033L15.9697 7.46967L7.96967 15.4697L9.03033 16.5303Z' />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};
