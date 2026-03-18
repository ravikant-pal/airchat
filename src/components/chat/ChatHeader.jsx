import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Avatar,
  Badge,
  Box,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getAvatarFromCache } from '../../services/cacheService';
import { db } from '../../services/db';

dayjs.extend(relativeTime);

export function ChatHeader({ peerId, onBack }) {
  const isMobile = useMediaQuery('(max-width:768px)');
  const contact = useLiveQuery(() => db.contacts.get(peerId), [peerId]);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (contact?.avatarKey) {
      getAvatarFromCache(contact?.avatarKey).then(setAvatarUrl);
    }
  }, [contact?.avatarKey]);

  const handleManualReconnect = async () => {
    if (!window.manualReconnect || isReconnecting) return;

    setIsReconnecting(true);
    try {
      await window.manualReconnect(peerId);
    } catch (error) {
      console.error('Manual reconnect failed:', error);
    } finally {
      // Keep showing reconnecting state until connection status changes
      setTimeout(() => {
        setIsReconnecting(false);
      }, 2000);
    }
  };

  const getStatusBadgeColor = () => {
    if (contact?.connectionStatus === 'connecting') return 'warning';
    if (contact?.connectionStatus === 'connected') return 'success';
    return 'default';
  };

  useEffect(() => {
    if (isReconnecting) {
      const reconnectInterval = setInterval(async () => {
        try {
          await window.manualReconnect(peerId);
          clearInterval(reconnectInterval);
          setIsReconnecting(false);
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
        }
      }, 5000); // Retry every 5 seconds

      return () => clearInterval(reconnectInterval);
    }
  }, [isReconnecting, peerId]);

  const showReconnectButton =
    contact?.connectionStatus === 'failed' ||
    (!contact?.online && contact?.connectionStatus === 'disconnected');

  return (
    <Box
      display='flex'
      alignItems='center'
      gap={1}
      px={2}
      py={1}
      borderBottom='1px solid #2a3942'
    >
      {isMobile && (
        <IconButton onClick={onBack}>
          <ArrowBackIcon sx={{ color: '#fff' }} />
        </IconButton>
      )}
      <Badge
        overlap='circular'
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        variant='dot'
        color={getStatusBadgeColor()}
      >
        <Avatar src={avatarUrl}>{contact?.name?.[0]?.toUpperCase()}</Avatar>
      </Badge>

      <Box flex={1}>
        <Box display='flex' alignItems='center' gap={1}>
          <Typography fontWeight={500}>{contact?.name || peerId}</Typography>
        </Box>
        <Typography variant='caption' color='text.secondary'>
          {contact?.isTyping // Check typing from contacts table
            ? 'typing…'
            : contact?.online
              ? 'online'
              : contact?.lastSeen
                ? `last seen ${dayjs(contact?.lastSeen).fromNow()}`
                : 'offline'}
        </Typography>
      </Box>

      {showReconnectButton && (
        <Tooltip title='Reconnect'>
          <IconButton
            onClick={handleManualReconnect}
            disabled={
              isReconnecting || contact?.connectionStatus === 'connecting'
            }
            size='small'
            sx={{
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'rgba(144, 202, 249, 0.08)',
              },
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
