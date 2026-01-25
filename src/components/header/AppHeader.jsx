import DarkModeIcon from '@mui/icons-material/DarkMode';
import FullscreenExitRounded from '@mui/icons-material/FullscreenExitRounded';
import FullscreenRounded from '@mui/icons-material/FullscreenRounded';
import LightModeIcon from '@mui/icons-material/LightMode';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  AppBar,
  IconButton,
  InputAdornment,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import ProfileDialog from '../modals/ProfileDialog';

export function AppHeader({ search, onSearch, toggleTheme, themeMode }) {
  const [openProfile, setOpenProfile] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = async () => {
    const body = document.body;

    try {
      if (body.requestFullscreen) {
        await body.requestFullscreen();
      } else if (body.webkitRequestFullscreen) {
        await body.webkitRequestFullscreen();
      } else if (body.mozRequestFullScreen) {
        await body.mozRequestFullScreen();
      } else if (body.msRequestFullscreen) {
        await body.msRequestFullscreen();
      }
    } catch (_e) {
      // Silence harmless errors
    }
  };

  const exitFullscreen = async () => {
    const document = window.document;
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullScreen) {
        await document.msExitFullScreen();
      }
    } catch (_e) {
      // Silence harmless errors
    }
  };

  useEffect(() => {
    if (isFullscreen) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }, [isFullscreen]);

  return (
    <AppBar position='sticky'>
      <Toolbar>
        <Typography flex={1} fontSize={24} fontWeight={600}>
          AirChat
        </Typography>
        <IconButton onClick={() => setOpenProfile(true)}>
          <SettingsIcon />
        </IconButton>
        <Tooltip
          title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
        >
          <IconButton onClick={toggleTheme}>
            {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          <IconButton
            size='large'
            edge='end'
            color='inherit'
            aria-label='fullscreen'
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <FullscreenExitRounded /> : <FullscreenRounded />}
          </IconButton>
        </Tooltip>
      </Toolbar>
      <TextField
        placeholder='Search contacts'
        variant='outlined'
        size='small'
        fullWidth
        value={search}
        sx={{
          mb: 1,
          px: 1,
          '& .MuiOutlinedInput-root': {
            borderRadius: 5,
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position='start'>
                <SearchRounded color='primary' />
              </InputAdornment>
            ),
          },
        }}
        onChange={onSearch}
      />
      <ProfileDialog open={openProfile} setOpen={setOpenProfile} />
    </AppBar>
  );
}
