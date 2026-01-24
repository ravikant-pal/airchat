import { useEffect, useState } from 'react';

export const AppLayout = ({ children, isMobile }) => {
  const [showSidebar, setShowSidebar] = useState(!isMobile);

  useEffect(() => {
    setShowSidebar(!isMobile);
  }, [isMobile]);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#111b21',
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .mobile-back-btn {
            display: block !important;
          }
        }
        
        * {
          box-sizing: border-box;
        }
        
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
                       "Helvetica Neue", Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        ::-webkit-scrollbar {
          width: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>

      {children}
    </div>
  );
};
