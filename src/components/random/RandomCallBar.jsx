import CallEndRounded from '@mui/icons-material/CallEndRounded';
import MicOffRounded from '@mui/icons-material/MicOffRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import VideocamOffRounded from '@mui/icons-material/VideocamOffRounded';
import VideocamRounded from '@mui/icons-material/VideocamRounded';
import { Box, IconButton, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useRandomConnect } from '../../contexts/RandomConnectProvider';

function CallTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return (
    <Typography variant='caption' color='text.secondary' fontFamily='monospace'>
      {mm}:{ss}
    </Typography>
  );
}

function MediaElement({ stream, video, muted }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream;
      el.play?.().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  if (video) {
    return (
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, background: '#000' }}
      />
    );
  }
  return (
    <Box sx={{ display: 'none' }}>
      <audio ref={ref} autoPlay playsInline muted={muted} />
    </Box>
  );
}

export function RandomCallBar() {
  const { call, localStream, remoteStream, toggleMic, toggleCam, endCall } = useRandomConnect();
  const isVideo = call.mode === 'video';

  if (call.status !== 'active') return null;

  return (
    <Box sx={{ borderTop: '1px solid #2a3942', bgcolor: 'background.paper' }}>
      <Box display='flex' alignItems='center' justifyContent='space-between' px={2} py={1}>
        <Box display='flex' alignItems='center' gap={1}>
          <CallTimer startedAt={call.startedAt} />
          <Typography variant='caption' color='text.secondary'>
            {isVideo ? 'Video call' : 'Voice call'}
          </Typography>
        </Box>
        <Box display='flex' gap={0.5}>
          <IconButton
            size='small'
            color={call.micOn ? 'primary' : 'error'}
            onClick={toggleMic}
            title={call.micOn ? 'Mute' : 'Unmute'}
          >
            {call.micOn ? <MicRounded fontSize='small' /> : <MicOffRounded fontSize='small' />}
          </IconButton>
          {isVideo && (
            <IconButton
              size='small'
              color={call.camOn ? 'primary' : 'error'}
              onClick={toggleCam}
              title={call.camOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {call.camOn ? <VideocamRounded fontSize='small' /> : <VideocamOffRounded fontSize='small' />}
            </IconButton>
          )}
          <IconButton size='small' color='error' onClick={endCall} title='End call'>
            <CallEndRounded fontSize='small' />
          </IconButton>
        </Box>
      </Box>

      {isVideo ? (
        <Box display='flex' gap={1} px={2} pb={1.5} height={220}>
          <Box flex={1} minWidth={0} position='relative'>
            <MediaElement stream={remoteStream} video muted={false} />
            {!remoteStream && (
              <Box
                position='absolute'
                inset={0}
                display='flex'
                alignItems='center'
                justifyContent='center'
                color='text.secondary'
                fontSize='0.8rem'
              >
                Waiting for their camera…
              </Box>
            )}
          </Box>
          <Box width={140} position='relative' flexShrink={0}>
            <MediaElement stream={localStream} video muted />
          </Box>
        </Box>
      ) : (
        <Box px={2} pb={1}>
          <MediaElement stream={remoteStream} video={false} muted={false} />
        </Box>
      )}
    </Box>
  );
}