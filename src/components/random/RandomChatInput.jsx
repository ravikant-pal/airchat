import SendRounded from '@mui/icons-material/SendRounded';
import { Box, IconButton, TextField, alpha } from '@mui/material';
import { useRef, useState } from 'react';
import { useRandomConnect } from '../../contexts/RandomConnectProvider';

export function RandomChatInput() {
  const { sendMessage, sendTyping } = useRandomConnect();
  const [text, setText] = useState('');
  const typingTimeout = useRef(null);
  const isTyping = useRef(false);

  const sendTypingState = (state) => {
    if (!isTyping.current && state) {
      isTyping.current = true;
      sendTyping(true);
    }
    if (!state && isTyping.current) {
      isTyping.current = false;
      sendTyping(false);
    }
  };

  const handleTyping = (value) => {
    setText(value);
    sendTypingState(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTypingState(false), 1200);
  };

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    sendMessage(value);
    setText('');
    clearTimeout(typingTimeout.current);
    sendTypingState(false);
  };

  return (
    <Box display='flex' alignItems='flex-end' p={1}>
      <TextField
        multiline
        maxRows={4}
        fullWidth
        size='small'
        value={text}
        placeholder='Type a message'
        onChange={(e) => handleTyping(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        sx={{
          '& .MuiOutlinedInput-root': { borderRadius: 10 },
        }}
        slotProps={{
          input: {
            endAdornment: text ? (
              <IconButton
                onClick={submit}
                sx={{
                  backgroundColor: (theme) => alpha(theme.palette.primary.light, 0.2),
                  '&:hover': { backgroundColor: 'primary.main' },
                }}
              >
                <SendRounded color='primary' />
              </IconButton>
            ) : null,
          },
        }}
      />
    </Box>
  );
}