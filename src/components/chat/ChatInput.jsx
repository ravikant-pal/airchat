import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import {
  alpha,
  Box,
  IconButton,
  InputAdornment,
  TextField,
  useMediaQuery,
} from '@mui/material';
import { useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../../services/db';
import { peerService } from '../../services/peerService';

export function ChatInput({ peerId }) {
  const isMobile = useMediaQuery('(max-width:768px)');
  const [text, setText] = useState('');
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeout = useRef(null);
  const isTyping = useRef(false);

  const sendTyping = (state) => {
    peerService.connect(peerId);
    peerService.send(peerId, { type: 'typing', isTyping: state });
  };

  const handleTyping = (value) => {
    setText(value);
    if (!isTyping.current) {
      sendTyping(true);
      isTyping.current = true;
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      sendTyping(false);
      isTyping.current = false;
    }, 1200);
  };

  const sendMessage = async () => {
    if (!text.trim() && !filePreview) return;

    const messageId = uuid();
    const timestamp = Date.now();

    try {
      if (text.trim()) {
        // // Store message locally first
        await db.messages.add({
          peerId,
          sender: 'me',
          content: text,
          timestamp,
          status: 'sent',
          type: 'text',
          id: messageId,
        });

        // Send to peer
        peerService.send(peerId, {
          type: 'message',
          id: messageId,
          text: text,
          timestamp,
        });
      }

      if (filePreview) {
        const { name, type, base64 } = filePreview;
        const fileMessageId = uuid(); // Separate ID for file

        // Store file message locally
        await db.messages.add({
          peerId,
          sender: 'me',
          content: name,
          timestamp,
          status: 'sent',
          type: 'file',
          file: base64,
          id: fileMessageId,
        });

        // Send to peer
        peerService.send(peerId, {
          type: 'file',
          id: fileMessageId,
          fileName: name,
          fileType: type,
          fileBase64: base64,
          timestamp,
        });

        setFilePreview(null);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      isTyping.current = false;
      sendTyping(false);
      setText('');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview({
        base64: reader.result,
        name: file.name,
        type: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Box display='flex' alignItems='flex-end' p={1}>
      <input
        ref={fileInputRef}
        type='file'
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <TextField
        multiline
        maxRows={5}
        fullWidth
        size={isMobile ? 'small' : 'medium'}
        value={text}
        placeholder={
          filePreview ? `Send file: ${filePreview.name}` : 'Type a message'
        }
        onChange={(e) => handleTyping(e.target.value)}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
          },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position='start'>
                <IconButton
                  size={isMobile ? 'small' : 'medium'}
                  onClick={() => fileInputRef.current.click()}
                >
                  <AttachFileRounded color='disabled' />
                </IconButton>
              </InputAdornment>
            ),
            endAdornment:
              text || filePreview ? (
                <InputAdornment position='end'>
                  <IconButton
                    size={isMobile ? 'small' : 'medium'}
                    onClick={sendMessage}
                    sx={{
                      backgroundColor: (theme) =>
                        alpha(theme.palette.primary.light, 0.2),
                      '&:hover': {
                        backgroundColor: 'primary.main',
                      },
                    }}
                  >
                    <SendRounded color='primary' />
                  </IconButton>
                </InputAdornment>
              ) : null,
          },
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }}
      />
    </Box>
  );
}
