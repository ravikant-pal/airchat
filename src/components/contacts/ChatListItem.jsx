import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import {
  Avatar,
  Badge,
  Box,
  Chip,
  CircularProgress,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getAvatarFromCache } from '../../services/cacheService';
import { db } from '../../services/db';

export function ChatListItem({
  peerId,
  name,
  username,
  avatarKey,
  online,
  lastSeen,
  onClick,
  connectionStatus,
  isAccepted,
}) {
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Get last message and unread count
  const lastMessage = useLiveQuery(async () => {
    const messages = await db.messages
      .where('peerId')
      .equals(peerId)
      .reverse()
      .sortBy('timestamp');
    return messages[0];
  }, [peerId]);

  const unreadCount = useLiveQuery(async () => {
    const count = await db.messages
      .where('peerId')
      .equals(peerId)
      .and((msg) => msg.sender === 'peer' && msg.status !== 'seen')
      .count();
    return count;
  }, [peerId]);

  useEffect(() => {
    if (avatarKey) {
      getAvatarFromCache(avatarKey).then(setAvatarUrl);
    }
  }, [avatarKey]);

  const getStatusChip = () => {
    if (isAccepted === false && connectionStatus === 'connecting') {
      return (
        <Chip
          label='Pending'
          size='small'
          color='warning'
          icon={<HourglassEmptyIcon />}
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      );
    }

    if (isAccepted === true && connectionStatus === 'connecting') {
      return (
        <Chip
          label='Connecting...'
          size='small'
          color='info'
          icon={<CircularProgress size={12} />}
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      );
    }

    if (connectionStatus === 'failed') {
      return (
        <Chip
          label='Failed'
          size='small'
          color='error'
          icon={<ErrorOutlineIcon />}
          sx={{ height: 20, fontSize: '0.7rem' }}
        />
      );
    }

    return null;
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'offline';

    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';

    const now = Date.now();
    const diff = now - timestamp;
    const today = new Date().setHours(0, 0, 0, 0);
    const msgDate = new Date(timestamp).setHours(0, 0, 0, 0);

    // If today, show time
    if (msgDate === today) {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    // If yesterday
    if (msgDate === today - 86400000) {
      return 'Yesterday';
    }

    // If within a week, show day name
    if (diff < 7 * 86400000) {
      return new Date(timestamp).toLocaleDateString('en-US', {
        weekday: 'short',
      });
    }

    // Otherwise show date
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getLastMessagePreview = () => {
    if (!lastMessage) return '';

    let preview = '';

    // Add sender prefix for messages you sent
    if (lastMessage.sender === 'me') {
      preview = 'You: ';
    }

    // Add message content
    if (lastMessage.type === 'file') {
      preview += `📎 ${lastMessage.content}`;
    } else {
      preview += lastMessage.content;
    }

    // Truncate if too long
    if (preview.length > 35) {
      preview = preview.substring(0, 35) + '...';
    }

    return preview;
  };

  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        '&:hover': { backgroundColor: '#202c33' },
        borderRadius: 3,
        mb: 0.5,
        mx: 1,
      }}
    >
      <ListItemAvatar>
        <Badge
          overlap='circular'
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          variant='dot'
          color='success'
          invisible={!online}
        >
          <Avatar src={avatarUrl}>{name?.[0]?.toUpperCase()}</Avatar>
        </Badge>
      </ListItemAvatar>

      <ListItemText
        disableTypography
        primary={
          <Box
            display='flex'
            alignItems='center'
            justifyContent='space-between'
          >
            <Box display='flex' alignItems='center' gap={1} flex={1}>
              <Typography variant='body1' component='span' noWrap>
                {name}
              </Typography>
              {getStatusChip()}
            </Box>
            {lastMessage && (
              <Typography
                variant='caption'
                color='text.secondary'
                component='span'
                sx={{ ml: 1, fontSize: '0.7rem' }}
              >
                {formatMessageTime(lastMessage.timestamp)}
              </Typography>
            )}
          </Box>
        }
        secondary={
          <Box
            display='flex'
            alignItems='center'
            justifyContent='space-between'
            mt={0.5}
          >
            <Typography
              variant='body2'
              color='text.secondary'
              component='span'
              noWrap
              sx={{ flex: 1, fontSize: '0.875rem' }}
            >
              {lastMessage ? (
                getLastMessagePreview()
              ) : (
                <>
                  {username && `@${username} • `}
                  {online ? 'online' : formatLastSeen(lastSeen)}
                </>
              )}
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={unreadCount > 99 ? '99+' : unreadCount}
                size='small'
                color='primary'
                sx={{
                  height: 20,
                  minWidth: 20,
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  ml: 1,
                }}
              />
            )}
          </Box>
        }
      />
    </ListItemButton>
  );
}
