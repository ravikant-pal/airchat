import DarkModeIcon from '@mui/icons-material/DarkMode';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  AppBar,
  IconButton,
  InputAdornment,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import ProfileDialog from '../modals/ProfileDialog';

export function AppHeader({ search, onSearch }) {
  const [openProfile, setOpenProfile] = useState(false);
  return (
    <AppBar position='sticky'>
      <Toolbar>
        <Typography flex={1} fontSize={24} fontWeight={600}>
          AirChat
        </Typography>
        <IconButton onClick={() => setOpenProfile(true)}>
          <SettingsIcon />
        </IconButton>
        <IconButton>
          <DarkModeIcon />
        </IconButton>
        <IconButton>
          <FullscreenIcon />
        </IconButton>
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
