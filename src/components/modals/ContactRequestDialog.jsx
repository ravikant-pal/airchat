import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getAvatarFromCache } from '../../services/cacheService';
import { db } from '../../services/db';

export function ContactRequestDialog({ request, onAccept, onReject }) {
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Get the full pending request with profile info
  const pendingRequest = useLiveQuery(
    () => (request ? db.pendingRequests.get(request.peerId) : null),
    [request?.peerId],
  );

  useEffect(() => {
    if (pendingRequest?.profile?.avatarKey) {
      getAvatarFromCache(pendingRequest.profile.avatarKey).then(setAvatarUrl);
    }
  }, [pendingRequest?.profile?.avatarKey]);

  if (!request || !pendingRequest) return null;

  const profile = pendingRequest.profile || {};
  const displayName = profile.name || profile.username || request.peerId;

  return (
    <Dialog open={true} maxWidth='sm' fullWidth>
      <DialogTitle>Contact Request</DialogTitle>
      <DialogContent>
        <Box display='flex' alignItems='center' gap={2} mb={2}>
          <Avatar src={avatarUrl} sx={{ width: 56, height: 56 }}>
            {displayName[0]?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant='h6'>{displayName}</Typography>
            {profile.username && profile.name && (
              <Typography variant='body2' color='text.secondary'>
                @{profile.username}
              </Typography>
            )}
            <Typography variant='caption' color='text.secondary'>
              Peer ID: {request.peerId.substring(0, 8)}...
            </Typography>
          </Box>
        </Box>
        <DialogContentText>wants to connect with you</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onReject(request.peerId)} color='error'>
          Reject
        </Button>
        <Button
          onClick={() => onAccept(request.peerId)}
          variant='contained'
          sx={{ borderRadius: 2 }}
        >
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
}
