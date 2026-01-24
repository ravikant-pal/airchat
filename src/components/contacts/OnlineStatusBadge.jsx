export const OnlineStatusBadge = ({ online }) => {
  return (
    <div
      style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: online ? '#10b981' : '#94a3b8',
        border: '2px solid white',
        boxShadow: online ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none',
      }}
    />
  );
};
