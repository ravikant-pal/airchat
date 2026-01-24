import { useState } from 'react';

export const AddContactModal = ({
  onAdd,
  onClose,
  myPersonalRoomId,
  myUsername,
}) => {
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState('add'); // 'add' or 'share'

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!roomId.trim()) {
      setError('Please enter a room ID or username');
      return;
    }

    // Clean the input
    let cleanRoomId = roomId.trim();

    // If starts with @, it's a username - keep it as is
    // Otherwise, assume it's a room ID
    if (!cleanRoomId.startsWith('@') && !cleanRoomId.startsWith('room-')) {
      cleanRoomId = '@' + cleanRoomId;
    }

    if (cleanRoomId === myPersonalRoomId || cleanRoomId === `@${myUsername}`) {
      setError("You can't add yourself");
      return;
    }

    onAdd(cleanRoomId);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          padding: '40px',
          borderRadius: '20px',
          maxWidth: '550px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '24px', color: '#111b21' }}>
            Add Contact
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#667781',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Mode Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: '2px solid #f0f2f5',
          }}
        >
          <button
            onClick={() => setMode('add')}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom:
                mode === 'add' ? '2px solid #25d366' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              color: mode === 'add' ? '#25d366' : '#667781',
              marginBottom: '-2px',
            }}
          >
            Add Contact
          </button>
          <button
            onClick={() => setMode('share')}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom:
                mode === 'share'
                  ? '2px solid #25d366'
                  : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              color: mode === 'share' ? '#25d366' : '#667781',
              marginBottom: '-2px',
            }}
          >
            Share Your ID
          </button>
        </div>

        {mode === 'share' ? (
          // Share Your Info
          <div>
            {myUsername && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '20px',
                  background: '#e7ffdb',
                  borderRadius: '12px',
                  border: '2px solid #25d366',
                }}
              >
                <p
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#111b21',
                  }}
                >
                  👤 Your Username
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <code
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: 'white',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#25d366',
                      wordBreak: 'break-all',
                    }}
                  >
                    @{myUsername}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`@${myUsername}`)}
                    style={{
                      padding: '12px 16px',
                      background: '#25d366',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
                <p
                  style={{
                    margin: '12px 0 0 0',
                    fontSize: '12px',
                    color: '#667781',
                  }}
                >
                  Share this username with others so they can find you easily
                </p>
              </div>
            )}

            <div
              style={{
                marginBottom: '20px',
                padding: '20px',
                background: myUsername ? '#f0f2f5' : '#e7ffdb',
                borderRadius: '12px',
                border: myUsername ? '1px solid #e4e6eb' : '2px solid #25d366',
              }}
            >
              <p
                style={{
                  margin: '0 0 12px 0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#111b21',
                }}
              >
                📱 Your Room ID
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <code
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: myUsername ? '#667781' : '#25d366',
                    wordBreak: 'break-all',
                  }}
                >
                  {myPersonalRoomId}
                </code>
                <button
                  onClick={() => copyToClipboard(myPersonalRoomId)}
                  style={{
                    padding: '12px 16px',
                    background: myUsername ? '#667781' : '#25d366',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>
              <p
                style={{
                  margin: '12px 0 0 0',
                  fontSize: '12px',
                  color: '#667781',
                }}
              >
                {myUsername
                  ? 'Alternative way for others to connect with you'
                  : 'Share this ID with others so they can connect with you'}
              </p>
            </div>

            <div
              style={{
                padding: '16px',
                background: '#fff3cd',
                borderRadius: '10px',
                border: '1px solid #ffc107',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#856404',
                  lineHeight: '1.5',
                }}
              >
                💡 <strong>Tip:</strong>{' '}
                {myUsername
                  ? 'Your username is easier to share and remember!'
                  : 'Consider setting a username in settings for easier sharing'}
              </p>
            </div>
          </div>
        ) : (
          // Add Contact Form
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  color: '#111b21',
                  fontSize: '15px',
                }}
              >
                Enter Username or Room ID
              </label>
              <input
                type='text'
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setError('');
                }}
                placeholder='@username or room-id'
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `2px solid ${error ? '#ef4444' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.3s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) =>
                  !error && (e.target.style.borderColor = '#25d366')
                }
                onBlur={(e) =>
                  !error && (e.target.style.borderColor = '#e2e8f0')
                }
              />
              {error && (
                <p
                  style={{
                    margin: '8px 0 0 0',
                    color: '#ef4444',
                    fontSize: '13px',
                  }}
                >
                  {error}
                </p>
              )}
              <p
                style={{
                  margin: '8px 0 0 0',
                  fontSize: '13px',
                  color: '#667781',
                }}
              >
                Examples: @john, room-abc123
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                type='button'
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#f0f2f5',
                  color: '#111b21',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type='submit'
                style={{
                  flex: 1,
                  padding: '14px',
                  background: '#25d366',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
                }}
              >
                Connect
              </button>
            </div>

            <div
              style={{
                padding: '16px',
                background: '#e7f3ff',
                borderRadius: '10px',
                border: '1px solid #2196f3',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#0d47a1',
                  lineHeight: '1.5',
                }}
              >
                ℹ️ <strong>How it works:</strong> Enter their username or room
                ID and you'll connect to their room. You'll be able to chat when
                they're online.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
