import { createContext, useContext, useEffect, useState } from 'react';

const FullscreenContext = createContext(null);

export function FullscreenProvider({ children }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const enterFullscreen = async () => {
    await document.documentElement.requestFullscreen();
  };

  const exitFullscreen = async () => {
    await document.exitFullscreen();
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  };

  return (
    <FullscreenContext.Provider value={{ isFullscreen, toggleFullscreen }}>
      {children}
    </FullscreenContext.Provider>
  );
}

export const useFullscreen = () => useContext(FullscreenContext);
