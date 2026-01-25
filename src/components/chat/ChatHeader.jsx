import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Avatar,
  Box,
  IconButton,
  Typography,
  useMediaQuery,
} from '@mui/material';
import dayjs from 'dayjs';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getAvatarFromCache } from '../../services/cacheService';
import { db } from '../../services/db';

export function ChatHeader({ peerId, onBack }) {
  const isMobile = useMediaQuery('(max-width:768px)');
  const contact = useLiveQuery(() => db.contacts.get(peerId), [peerId]);
  const typing = useLiveQuery(() => db.typing.get(peerId), [peerId]);
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (contact?.avatarKey) {
      getAvatarFromCache(contact?.avatarKey).then(setAvatarUrl);
    }
  }, [contact?.avatarKey]);

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

      <Avatar src={avatarUrl}>{contact?.name?.[0]?.toUpperCase()}</Avatar>
      <Box>
        <Typography fontWeight={500}>{contact?.name || peerId}</Typography>
        <Typography variant='caption' color='text.secondary'>
          {typing?.isTyping
            ? 'typing…'
            : contact?.online
              ? 'online'
              : contact?.lastSeen
                ? `last seen ${dayjs(contact?.lastSeen).fromNow()}`
                : 'offline'}
        </Typography>
      </Box>
    </Box>
  );
}
