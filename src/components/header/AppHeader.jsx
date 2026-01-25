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
import { useState } from 'react';
import { useFullscreen } from '../../contexts/FullscreenProvider';
import ProfileDialog from '../modals/ProfileDialog';

export function AppHeader({ search, onSearch, toggleTheme, themeMode }) {
  const [openProfile, setOpenProfile] = useState(false);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

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
            onClick={toggleFullscreen}
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
