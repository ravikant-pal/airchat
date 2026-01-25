import { CssBaseline, ThemeProvider } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { darkTheme, lightTheme } from './theme/theme';

import { registerSW } from 'virtual:pwa-register';

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
      <App toggleTheme={toggleTheme} themeMode={mode} />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
