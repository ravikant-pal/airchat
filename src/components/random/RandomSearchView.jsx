import CasinoRounded from '@mui/icons-material/CasinoRounded';
import ChatBubbleRounded from '@mui/icons-material/ChatBubbleRounded';
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { useRandomConnect } from '../../contexts/RandomConnectProvider';

export function RandomSearchView({ onBackToChats }) {
  const { phase, start, leave } = useRandomConnect();

  return (
    <Box height='100dvh' display='flex' flexDirection='column' overflow='hidden'>
      <AppBar position='static'>
        <Toolbar>
          <Tooltip title='Back to chats'>
            <IconButton edge='start' color='inherit' onClick={onBackToChats} sx={{ mr: 1 }}>
              <ChatBubbleRounded />
            </IconButton>
          </Tooltip>
          <Typography flex={1} fontSize={20} fontWeight={600}>
            Random Connect
          </Typography>
        </Toolbar>
      </AppBar>

      <Box flex={1} display='flex' alignItems='center' justifyContent='center' p={2}>
        {phase === 'idle' ? (
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 420,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              textAlign: 'center',
              borderRadius: 3,
            }}
          >
            <CasinoRounded sx={{ fontSize: 64 }} color='primary' />
            <Typography variant='h5' fontWeight={700}>
              Get matched
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Meet a random stranger for a one-on-one text, voice &amp; video
              chat. Sessions are temporary and fully peer-to-peer — nothing you
              say here is saved or stored.
            </Typography>
            <Button variant='contained' size='large' onClick={start} sx={{ borderRadius: 5, px: 4 }}>
              Start
            </Button>
          </Paper>
        ) : (
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 380,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              textAlign: 'center',
              borderRadius: 3,
            }}
          >
            <CircularProgress />
            <Typography fontWeight={600}>Searching for an online stranger…</Typography>
            <Typography variant='body2' color='text.secondary'>
              This only connects you with people who are online right now. Hang
              tight — we hop to a new room if nobody is available.
            </Typography>
            <Button onClick={leave} color='inherit'>
              Cancel
            </Button>
          </Paper>
        )}
      </Box>
    </Box>
  );
}