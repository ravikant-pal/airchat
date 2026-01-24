import { Avatar } from '../shared/Avatar';

export const Header = ({
  displayName,
  username,
  personalRoomId,
  onShowProfile,
}) => {
  return (
    <div
      style={{
        padding: '16px 20px',
        background: '#008069',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Avatar name={displayName} size={40} online={true} />
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '500',
              textShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
          >
            {displayName}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              opacity: 0.9,
            }}
          >
            {username ? `@${username}` : personalRoomId}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* <button
          onClick={onShowProfile}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) =>
            (e.target.style.background = 'rgba(255,255,255,0.3)')
          }
          onMouseOut={(e) =>
            (e.target.style.background = 'rgba(255,255,255,0.2)')
          }
        >
          ⚙️ Settings
        </button> */}
      </div>
    </div>
  );
};
