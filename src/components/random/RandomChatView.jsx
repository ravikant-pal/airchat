import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CallRounded from '@mui/icons-material/CallRounded';
import CallEndRounded from '@mui/icons-material/CallEndRounded';
import ExitToAppRounded from '@mui/icons-material/ExitToAppRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import PhoneRounded from '@mui/icons-material/PhoneRounded';
import SkipNextRounded from '@mui/icons-material/SkipNextRounded';
import VideocamRounded from '@mui/icons-material/VideocamRounded';
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { useRandomConnect } from '../../contexts/RandomConnectProvider';
import { MessageList } from '../chat/MessageList';
import { RandomCallBar } from './RandomCallBar';
import { RandomChatInput } from './RandomChatInput';

const RANDOM_LIST_PEER = '__random_connect__';

function IncomingCallOverlay() {
  const { incomingCall, acceptCall, declineCall } = useRandomConnect();
  if (!incomingCall) return null;
  const isVideo = incomingCall.mode === 'video';

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 1400,
        bgcolor: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 4,
          maxWidth: 340,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          textAlign: 'center',
          borderRadius: 3,
        }}
      >
        <Avatar sx={{ width: 72, height: 72, bgcolor: 'success.main' }}>
          <CallRounded sx={{ fontSize: 36 }} />
        </Avatar>
        <Typography variant='h6' fontWeight={600}>
          Incoming {isVideo ? 'video' : 'voice'} call
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          A random stranger wants to talk. Accepting shares your camera or
          microphone with them.
        </Typography>
        <Box display='flex' gap={1.5}>
          <Button color='error' variant='outlined' onClick={declineCall} sx={{ borderRadius: 5 }}>
            Decline
          </Button>
          <Button
            variant='contained'
            color='success'
            onClick={() => acceptCall(incomingCall.mode)}
            sx={{ borderRadius: 5 }}
          >
            Accept
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

function RandomChatHeader({ onBackToChats }) {
  const { peerName, isTyping, call, requestCall, next, leave, endCall } = useRandomConnect();

  const inCall = call.status === 'active';
  const ringing = call.status === 'ringing';

  const subtitle = isTyping
    ? 'typing…'
    : inCall
      ? call.mode === 'video'
        ? 'Video call active'
        : 'Voice call active'
      : ringing
        ? 'Calling…'
        : 'Connected · random';

  return (
    <Box display='flex' alignItems='center' gap={1} px={1.5} py={1} borderBottom='1px solid #2a3942'>
      <IconButton onClick={onBackToChats} sx={{ color: '#fff' }}>
        <ArrowBackRounded />
      </IconButton>
      <Avatar sx={{ bgcolor: 'secondary.main' }}>
        <PersonRounded />
      </Avatar>
      <Box flex={1} minWidth={0}>
        <Typography fontWeight={500} noWrap>
          {peerName || 'Stranger'}
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {subtitle}
        </Typography>
      </Box>

      {!inCall && !ringing && (
        <>
          <Tooltip title='Voice call'>
            <IconButton size='small' onClick={() => requestCall('voice')}>
              <PhoneRounded />
            </IconButton>
          </Tooltip>
          <Tooltip title='Video call'>
            <IconButton size='small' onClick={() => requestCall('video')}>
              <VideocamRounded />
            </IconButton>
          </Tooltip>
        </>
      )}
      {ringing && (
        <Tooltip title='Cancel call'>
          <IconButton size='small' color='error' onClick={endCall}>
            <CallEndRounded />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title='Next — find another person'>
        <IconButton size='small' onClick={next}>
          <SkipNextRounded />
        </IconButton>
      </Tooltip>
      <Tooltip title='Leave random connect'>
        <IconButton size='small' color='error' onClick={leave}>
          <ExitToAppRounded />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export function RandomChatView({ onBackToChats }) {
  const { messages } = useRandomConnect();

  return (
    <Box height='100dvh' display='flex' flexDirection='column' overflow='hidden' position='relative'>
      <RandomChatHeader onBackToChats={onBackToChats} />
      <MessageList peerId={RANDOM_LIST_PEER} messages={messages} />
      <RandomCallBar />
      <RandomChatInput />
      <IncomingCallOverlay />
    </Box>
  );
}