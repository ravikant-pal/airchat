import {
  AlternateEmailRounded,
  CheckCircleRounded,
  ContentCopyRounded,
  PersonRounded,
  PhotoCameraRounded,
} from '@mui/icons-material';

import {
  Avatar,
  Box,
  Button,
  Dialog,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
  getAvatarFromCache,
  saveAvatarToCache,
} from '../../services/cacheService';
import { db } from '../../services/db';
import { getPubKey } from '../../services/nostrService';

export default function ProfileDialog({ open, setOpen }) {
  const [displayName, setDisplayName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [pubKey, setPubKey] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const key = getPubKey();
    setPubKey(key);

    (async () => {
      const profile = await db.profile.toCollection().first();
      if (!profile) {
        setOpen(true);
        return;
      }
      setDisplayName(profile.name ?? '');
      if (profile.avatarKey) {
        const url = await getAvatarFromCache(profile.avatarKey);
        setPhotoPreview(url);
      }
      setIsEdit(true);
    })();
  }, [open]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    let avatarKey = null;
    if (photo instanceof File) {
      avatarKey = `avatar_${pubKey.slice(0, 8)}_${dayjs().format('YYYYMMDD_HHmmss_SSS')}`;
      await saveAvatarToCache(avatarKey, photo);
    }
    if (isEdit) {
      const existing = await db.profile.toCollection().first();
      await db.profile.update(existing.peerId, {
        name: displayName,
        ...(avatarKey && { avatarKey }),
      });
    } else {
      await db.profile.add({
        peerId: pubKey,
        username: pubKey.slice(0, 12),
        name: displayName,
        avatarKey,
      });
    }
    setOpen(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pubKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Truncated display: first 8 + … + last 8 — fits on any screen
  const shortKey = pubKey ? `${pubKey.slice(0, 8)}…${pubKey.slice(-8)}` : '';

  return (
    <Dialog
      open={open}
      onClose={() => isEdit && setOpen(false)}
      fullWidth
      maxWidth='xs'
      PaperProps={{ sx: { borderRadius: 3, mx: 2 } }}
    >
      <Box px={3} pt={3} pb={2} textAlign='center'>
        <Typography variant='h6' fontWeight={700} mb={2.5}>
          {isEdit ? 'Edit Profile' : 'Welcome to AirChat'}
        </Typography>

        {/* Avatar */}
        <Box mb={2.5} position='relative' display='inline-block'>
          <Avatar
            src={photoPreview}
            sx={{ width: 80, height: 80, mx: 'auto' }}
          />
          <IconButton
            component='label'
            size='small'
            sx={{
              position: 'absolute',
              bottom: 0,
              right: -4,
              bgcolor: 'success.main',
              color: 'white',
              width: 28,
              height: 28,
              '&:hover': { bgcolor: 'success.dark' },
            }}
          >
            <PhotoCameraRounded sx={{ fontSize: 16 }} />
            <input
              hidden
              type='file'
              accept='image/*'
              onChange={handlePhotoChange}
            />
          </IconButton>
        </Box>

        {/* Display name */}
        <TextField
          fullWidth
          size='small'
          placeholder='Display name'
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 10 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position='start'>
                  <PersonRounded color='primary' fontSize='small' />
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Public key — truncated, full value copies on click */}
        <TextField
          fullWidth
          size='small'
          value={shortKey}
          disabled
          label='Your Public Key'
          helperText='Share this with others so they can add you'
          sx={{
            mb: 2.5,
            '& .MuiOutlinedInput-root': { borderRadius: 10 },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position='start'>
                  <AlternateEmailRounded color='disabled' fontSize='small' />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position='end'>
                  <Tooltip title={copied ? 'Copied!' : 'Copy full key'}>
                    <IconButton onClick={handleCopy} size='small' edge='end'>
                      {copied ? (
                        <CheckCircleRounded fontSize='small' color='primary' />
                      ) : (
                        <ContentCopyRounded fontSize='small' color='primary' />
                      )}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Buttons */}
        <Box display='flex' gap={1.5}>
          {isEdit && (
            <Button
              fullWidth
              variant='outlined'
              size='small'
              onClick={() => setOpen(false)}
              sx={{ borderRadius: 5, py: 1 }}
            >
              Cancel
            </Button>
          )}
          <Button
            fullWidth
            variant='contained'
            color='success'
            size='small'
            sx={{ borderRadius: 5, py: 1, whiteSpace: 'nowrap' }}
            onClick={handleSave}
            disabled={!displayName.trim()}
          >
            {isEdit ? 'Save' : 'Get Started'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
