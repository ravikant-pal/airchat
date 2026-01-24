export const Avatar = ({ name, size = 40, online = false }) => {
  const colors = [
    '#e74c3c',
    '#3498db',
    '#2ecc71',
    '#f39c12',
    '#9b59b6',
    '#1abc9c',
    '#34495e',
    '#e67e22',
  ];

  const getColorFromName = (name) => {
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: getColorFromName(name),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '600',
          fontSize: size * 0.4,
          userSelect: 'none',
        }}
      >
        {getInitials(name)}
      </div>
      {online && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: size * 0.3,
            height: size * 0.3,
            background: '#10b981',
            border: '2px solid white',
            borderRadius: '50%',
          }}
        />
      )}
    </div>
  );
};
