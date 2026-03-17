import AlternateEmailRounded from '@mui/icons-material/AlternateEmailRounded';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  useMediaQuery,
} from '@mui/material';
import { useState } from 'react';
import { nostrService as peerService } from '../../services/nostrService';

// Nostr pubkeys are 64-char lowercase hex strings
const PUBKEY_REGEX = /^[0-9a-f]{64}$/;

export function AddContactModal({ myProfile, open, setOpen }) {
  const isMobile = useMediaQuery('(max-width:768px)');
  const [peerId, setPeerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = (value) => {
    if (!value) return '';
    if (!PUBKEY_REGEX.test(value))
      return 'Enter a valid Nostr public key (64-character hex)';
    if (value === myProfile?.peerId) return 'You cannot add yourself';
    return '';
  };

  const handleChange = (e) => {
    const value = e.target.value.trim().toLowerCase();
    setPeerId(value);
    setError(validate(value));
  };

  const handleAdd = async () => {
    const err = validate(peerId);
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    try {
      await peerService.sendContactRequest(peerId, myProfile);
      setPeerId('');
      setOpen(false);
      setError('');
    } catch (e) {
      console.error('Error sending contact request:', e);
      setError('Failed to send request. Check the key and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setPeerId('');
    setError('');
    setOpen(false);
  };

  return (
    <Dialog open={open} fullWidth onClose={handleClose}>
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
          placeholder='Paste Nostr public key (npub or hex)'
          value={peerId}
          onChange={handleChange}
          disabled={loading}
          autoFocus
          multiline
          maxRows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAdd();
            }
          }}
          sx={{
            mb: 1,
            px: 1,
            '& .MuiOutlinedInput-root': { borderRadius: 4 },
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
          helperText={
            peerId && !error
              ? '✓ Valid public key'
              : 'Ask the other person to share their public key from their profile'
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleAdd}
          sx={{ borderRadius: 2 }}
          variant='contained'
          disabled={loading || !peerId.trim() || !!error}
        >
          {loading ? 'Sending...' : 'Send Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
