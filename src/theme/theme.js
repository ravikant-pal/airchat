import { createTheme } from '@mui/material';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0b141a',
      paper: '#111b21',
    },
    primary: {
      main: '#00a884',
    },
  },
});
