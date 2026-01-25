import { Alert, InputAdornment, useMediaQuery } from '@mui/material';

import AlternateEmailRounded from '@mui/icons-material/AlternateEmailRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { peerService } from '../../services/peerService';

const USERNAME_REGEX = /^[a-z0-9_]+$/;

export function AddContactModal({ myProfile, open, setOpen }) {
  const isMobile = useMediaQuery('(max-width:768px)');
  // const [open, setOpen] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUsernameChange = (e) => {
    const value = e.target.value.replace('@', '');

    if (!USERNAME_REGEX.test(value)) {
      setError('Only lowercase letters, numbers, and underscores');
    } else {
      setError('');
    }
    setPeerId(value);
  };

  const handleAdd = async () => {
    setError('');

    if (!peerId.trim()) {
      setError('Please enter a Peer ID');
      return;
    }

    if (peerId === myProfile?.peerId) {
      setError('You cannot add yourself as a contact');
      return;
    }

    setLoading(true);

    try {
      console.log(myProfile, 'myProfile');

      // Send contact request via PeerJS
      await peerService.sendContactRequest(peerId, myProfile);

      setPeerId('');
      setOpen(false);
      setError('');
    } catch (error) {
      console.error('Error sending contact request:', error);
      alert(
        'Failed to send contact request. Please check the Peer ID and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} fullWidth onClose={() => !loading && setOpen(false)}>
      <DialogTitle>Add Contact</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity='error' sx={{ mb: 2, borderRadius: 10 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          size={isMobile ? 'small' : 'medium'}
          placeholder='Enter @username'
          value={peerId}
          onChange={handleUsernameChange}
          disabled={loading}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          sx={{
            mb: 1,
            px: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
            },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position='start'>
                  <AlternateEmailRounded color='primary' />
                </InputAdornment>
              ),
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setOpen(false);
            setError('');
            setPeerId('');
          }}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleAdd}
          sx={{ borderRadius: 2 }}
          variant='contained'
          disabled={loading || !peerId.trim()}
        >
          {loading ? 'Sending...' : 'Send Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
