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

  const isDark = themeMode === 'dark';

  return (
    <AppBar position='sticky'>
      <Toolbar>
        <Typography flex={1} fontSize={24} fontWeight={600}>
          AirChat
        </Typography>
        {/* <IconButton
          onClick={() => setOpenProfile(true)}
          sx={{ color: 'inherit' }}
        >
          <PhonelinkEraseRounded />
        </IconButton> */}
        <IconButton
          onClick={() => setOpenProfile(true)}
          sx={{ color: 'inherit' }}
        >
          <SettingsIcon />
        </IconButton>
        <Tooltip title={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
          <IconButton onClick={toggleTheme} sx={{ color: 'inherit' }}>
            {isDark ? <LightModeIcon /> : <DarkModeIcon />}
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
        onChange={onSearch}
        sx={{
          mb: 1,
          px: 1,
          // In light mode the AppBar is the primary color (green).
          // Force white text/border/icon so it's readable on that background.
          // In dark mode the AppBar is already dark — keep normal styling.
          '& .MuiOutlinedInput-root': {
            borderRadius: 5,
            color: isDark ? 'text.primary' : 'white',
            '& fieldset': {
              borderColor: isDark
                ? 'rgba(255,255,255,0.2)'
                : 'rgba(255,255,255,0.5)',
            },
            '&:hover fieldset': {
              borderColor: isDark
                ? 'rgba(255,255,255,0.4)'
                : 'rgba(255,255,255,0.8)',
            },
            '&.Mui-focused fieldset': {
              borderColor: 'white',
            },
          },
          '& .MuiInputBase-input::placeholder': {
            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.75)',
            opacity: 1,
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position='start'>
                <SearchRounded
                  sx={{
                    color: isDark ? 'primary.main' : 'rgba(255,255,255,0.85)',
                  }}
                />
              </InputAdornment>
            ),
          },
        }}
      />

      <ProfileDialog open={openProfile} setOpen={setOpenProfile} />
    </AppBar>
  );
}
