import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import {
  Alert,
  alpha,
  Box,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  useMediaQuery,
} from '@mui/material';
import { useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../../services/db';
import { nostrService as peerService } from '../../services/nostrService';

export function ChatInput({ peerId }) {
  const isMobile = useMediaQuery('(max-width:768px)');
  const [text, setText] = useState('');
  const [filePreview, setFilePreview] = useState(null);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeout = useRef(null);
  const isTyping = useRef(false);

  const sendTyping = (state) => {
    if (peerService.isConnected(peerId)) {
      peerService.send(peerId, { type: 'typing', isTyping: state });
    }
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
    const isConnected = peerService.isConnected(peerId);

    try {
      if (text.trim()) {
        // Store locally first — always
        await db.messages.add({
          peerId,
          sender: 'me',
          content: text,
          timestamp,
          status: 'created',
          type: 'text',
          id: messageId,
        });

        // Always call send() regardless of connection state.
        // send() internally routes:
        //   WebRTC open  → DataChannel (fast, direct)
        //   WebRTC closed → Nostr DM relay (stored until peer subscribes)
        // This ensures B's messages reach the relay even when A is offline,
        // so A receives them when A comes back — even if B is offline by then.
        const sent = await peerService.send(peerId, {
          type: 'message',
          id: messageId,
          text,
          timestamp,
        });

        if (sent) {
          await db.messages.update(messageId, {
            status: isConnected ? 'sent' : 'sent',
          });
        } else {
          // send() returned false — typing/ping types only, won't happen for messages
          setShowOfflineWarning(true);
        }
      }

      if (filePreview) {
        const { name, type, base64 } = filePreview;
        const fileMessageId = uuid();

        await db.messages.add({
          peerId,
          sender: 'me',
          content: name,
          timestamp,
          status: 'created',
          type: 'file',
          file: base64,
          fileType: type,
          id: fileMessageId,
        });

        const sent = await peerService.send(peerId, {
          type: 'file',
          id: fileMessageId,
          fileName: name,
          fileType: type,
          fileBase64: base64,
          timestamp,
        });

        if (!sent) {
          setShowOfflineWarning(true);
        }

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
    <>
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

      <Snackbar
        open={showOfflineWarning}
        autoHideDuration={3000}
        onClose={() => setShowOfflineWarning(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowOfflineWarning(false)}
          severity='info'
          sx={{ width: '100%' }}
        >
          Peer offline — message queued via relay, will deliver when they
          reconnect.
        </Alert>
      </Snackbar>
    </>
  );
}
