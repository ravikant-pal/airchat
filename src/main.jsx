import { CssBaseline, ThemeProvider } from '@mui/material';
import { Suspense, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { darkTheme, lightTheme } from './theme/theme';

import { registerSW } from 'virtual:pwa-register';
import { FullscreenProvider } from './contexts/FullscreenProvider';
import { NostrProvider } from './contexts/NostrProvider';

registerSW({ immediate: true });

function Root() {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (mode === 'dark') metaTheme?.setAttribute('content', '#121212');
    else metaTheme?.setAttribute('content', '#ffffff');
    localStorage.setItem('theme', mode);
  }, [mode]);

  const theme = useMemo(() => {
    return mode === 'dark' ? darkTheme : lightTheme;
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <FullscreenProvider>
        <NostrProvider>
          <Suspense fallback={null}>
            <App toggleTheme={toggleTheme} themeMode={mode} />
          </Suspense>
        </NostrProvider>
      </FullscreenProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
