import DoneAllIcon from '@mui/icons-material/DoneAll';
import WatchLaterOutlined from '@mui/icons-material/WatchLaterOutlined';
import dayjs from 'dayjs';

import { Box, Paper, Typography } from '@mui/material';

export function MessageBubble({ message }) {
  const isMe = message.sender === 'me';

  // console.log("message",ne);

  const TickIcon = () => {
    if (!isMe) return null;

    if (message.status === 'seen') {
      return <DoneAllIcon sx={{ fontSize: 16, color: '#4fc3f7' }} />;
    }
    if (message.status === 'delivered') {
      return <DoneAllIcon sx={{ fontSize: 16 }} />;
    }
    return <WatchLaterOutlined sx={{ fontSize: 16 }} color='disabled' />;
  };

  const isImageFile =
    message.type === 'file' && message.file?.startsWith('data:image');

  return (
    <Box
      display='flex'
      justifyContent={isMe ? 'flex-end' : 'flex-start'}
      px={1}
      mb={0.5}
    >
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          maxWidth: '75%',
          px: 1.5,
          py: 1,
          bgcolor: isMe ? '#005c4b' : '#202c33',
          color: '#fff',
          borderRadius: isMe ? '10px 0 10px 10px' : '0 10px 10px 10px',

          /* bubble tail */
          '&::after': isMe
            ? {
                content: '""',
                position: 'absolute',
                top: 0,
                right: -8,
                width: 0,
                height: 0,
                borderTop: '8px solid #005c4b',
                borderLeft: '8px solid #005c4b',
                borderRight: '8px solid transparent',
                borderBottom: '8px solid transparent',
              }
            : {
                content: '""',
                position: 'absolute',
                top: 0,
                left: -8,
                width: 0,
                height: 0,
                borderTop: '8px solid #202c33',
                borderRight: '8px solid #202c33',
                borderLeft: '8px solid transparent',
                borderBottom: '8px solid transparent',
              },
        }}
      >
        {/* MESSAGE CONTENT */}
        {isImageFile ? (
          <Box
            component='img'
            src={message.file}
            alt={message.content}
            sx={{
              width: 220,
              maxHeight: 220,
              objectFit: 'cover',
              borderRadius: 1,
              cursor: 'pointer',
              mb: 0.5,
            }}
            onClick={() => window.open(message.file, '_blank')}
          />
        ) : (
          <Typography
            variant='body2'
            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {message.content}
          </Typography>
        )}

        {/* FOOTER (time + ticks) */}
        <Box
          display='flex'
          alignItems='center'
          justifyContent='flex-end'
          gap={0.4}
          mt={0.5}
        >
          <Typography
            variant='caption'
            sx={{
              fontSize: '0.7rem',
              color: '#a1a1a1',
              whiteSpace: 'nowrap',
            }}
          >
            {dayjs(message.timestamp).format('h:mm A')}
          </Typography>
          <TickIcon />
        </Box>
      </Paper>
    </Box>
  );
}
