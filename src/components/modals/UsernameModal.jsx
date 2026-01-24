import { useState } from 'react';

export const UsernameModal = ({ onSubmit }) => {
  const [step, setStep] = useState(1); // 1: display name, 2: username (optional)
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleDisplayNameSubmit = (e) => {
    e.preventDefault();

    if (displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters');
      return;
    }

    if (displayName.trim().length > 30) {
      setError('Display name must be less than 30 characters');
      return;
    }

    setError('');
    setStep(2);
  };

  const handleUsernameSubmit = (e) => {
    e.preventDefault();

    // Username is optional
    if (username.trim()) {
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters');
        return;
      }

      if (username.trim().length > 20) {
        setError('Username must be less than 20 characters');
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
        setError('Username can only contain letters, numbers, and underscores');
        return;
      }
    }

    onSubmit(displayName.trim(), username.trim() || null);
  };

  const handleSkipUsername = () => {
    onSubmit(displayName.trim(), null);
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
    >
      <div
        style={{
          background: 'white',
          padding: '40px',
          borderRadius: '20px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {step === 1 ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>💬</div>
              <h2
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '28px',
                  color: '#111b21',
                }}
              >
                Welcome to AirChat
              </h2>
              <p style={{ margin: 0, color: '#667781', fontSize: '15px' }}>
                Let's get you set up
              </p>
            </div>

            <form onSubmit={handleDisplayNameSubmit}>
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
                  Display Name
                </label>
                <input
                  type='text'
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setError('');
                  }}
                  placeholder='Enter your name'
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
                    color: '#667781',
                    fontSize: '13px',
                  }}
                >
                  This is how others will see you
                </p>
              </div>

              <button
                type='submit'
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#25d366',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) =>
                  (e.target.style.transform = 'translateY(-2px)')
                }
                onMouseOut={(e) => (e.target.style.transform = 'translateY(0)')}
              >
                Continue
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔑</div>
              <h2
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '28px',
                  color: '#111b21',
                }}
              >
                Choose a Username
              </h2>
              <p style={{ margin: 0, color: '#667781', fontSize: '15px' }}>
                Optional - This creates your personal room
              </p>
            </div>

            <form onSubmit={handleUsernameSubmit}>
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
                  Username (Optional)
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#667781',
                      fontSize: '16px',
                      fontWeight: '600',
                    }}
                  >
                    @
                  </span>
                  <input
                    type='text'
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError('');
                    }}
                    placeholder='myusername'
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 32px',
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
                </div>
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
                    color: '#667781',
                    fontSize: '13px',
                  }}
                >
                  {username.trim()
                    ? `Your room: @${username.trim().toLowerCase()}`
                    : 'Others can find you with this username'}
                </p>
              </div>

              <div
                style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}
              >
                <button
                  type='button'
                  onClick={handleSkipUsername}
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
                  Skip
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
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) =>
                    (e.target.style.transform = 'translateY(-2px)')
                  }
                  onMouseOut={(e) =>
                    (e.target.style.transform = 'translateY(0)')
                  }
                >
                  {username.trim() ? 'Create' : 'Skip'}
                </button>
              </div>

              <button
                type='button'
                onClick={() => setStep(1)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'transparent',
                  color: '#667781',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            </form>

            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                background: '#e7ffdb',
                borderRadius: '10px',
                border: '1px solid #25d366',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: '#111b21',
                  lineHeight: '1.5',
                }}
              >
                💡 <strong>With a username:</strong> Anyone can connect to you
                using @yourname
                <br />
                <strong>Without a username:</strong> You'll get a random room ID
                to share
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
