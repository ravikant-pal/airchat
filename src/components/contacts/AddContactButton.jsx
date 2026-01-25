import AddIcon from '@mui/icons-material/Add';
import { Fab } from '@mui/material';
import { useState } from 'react';
import { AddContactModal } from '../modals/AddContactModal';

export function AddContactButton({ myProfile }) {
  const [open, setOpen] = useState(false);

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
      <AddContactModal open={open} setOpen={setOpen} myProfile={myProfile} />
    </>
  );
}
