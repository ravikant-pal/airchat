import { Avatar } from '../shared/Avatar';

export const ContactItem = ({ contact, isActive, unreadCount, onClick }) => {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diff < 604800000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        background: isActive ? '#f0f2f5' : 'transparent',
        transition: 'background 0.2s',
        position: 'relative',
      }}
      onMouseOver={(e) =>
        !isActive && (e.currentTarget.style.background = '#f5f6f7')
      }
      onMouseOut={(e) =>
        !isActive && (e.currentTarget.style.background = 'transparent')
      }
    >
      <Avatar name={contact.displayName} size={48} online={contact.isOnline} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '500',
              color: '#050505',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {contact.displayName}
          </h3>
          <span
            style={{
              fontSize: '12px',
              color: '#8696a0',
            }}
          >
            {formatTime(contact.lastSeen)}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: '#8696a0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {contact.username
              ? `@${contact.username}`
              : contact.isOnline
                ? 'Online'
                : 'Offline'}
          </p>

          {unreadCount > 0 && (
            <div
              style={{
                background: '#25d366',
                color: 'white',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: '600',
                minWidth: '20px',
                textAlign: 'center',
              }}
            >
              {unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
