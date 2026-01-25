import AddIcon from '@mui/icons-material/Add';
import PeopleOutlineRounded from '@mui/icons-material/PeopleOutlineRounded';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  InputAdornment,
  TextField,
  useMediaQuery,
} from '@mui/material';
import { useState } from 'react';
import { peerService } from '../../services/peerService';

export function AddContactButton({ myProfile }) {
  const isMobile = useMediaQuery('(max-width:768px)');
  const [open, setOpen] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!peerId) return;

    setLoading(true);

    try {
      console.log(myProfile, 'myProfile');

      // Send contact request via PeerJS
      await peerService.sendContactRequest(peerId, myProfile);

      setPeerId('');
      setOpen(false);
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
    <>
      <Fab
        color='primary'
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
        }}
        onClick={() => setOpen(true)}
      >
        <AddIcon />
      </Fab>
      <Dialog open={open} fullWidth onClose={() => !loading && setOpen(false)}>
        <DialogTitle>Add Contact</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size={isMobile ? 'small' : 'medium'}
            placeholder='Enter Peer Id'
            value={peerId}
            onChange={(e) => setPeerId(e.target.value)}
            disabled={loading}
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
                    <PeopleOutlineRounded color='primary' />
                  </InputAdornment>
                ),
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            sx={{ borderRadius: 2 }}
            variant='contained'
            disabled={loading || !peerId}
          >
            {loading ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
