import AlternateEmailRounded from '@mui/icons-material/AlternateEmailRounded';
import PersonRounded from '@mui/icons-material/PersonRounded';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
  getAvatarFromCache,
  saveAvatarToCache,
} from '../../services/cacheService';
import { db } from '../../services/db';

const USERNAME_REGEX = /^[a-z0-9_]+$/;

export default function ProfileDialog({ open, setOpen }) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isEdit, setIsEdit] = useState(false);

  /* ---------------- Load profile for EDIT ---------------- */
  useEffect(() => {
    (async () => {
      const profile = await db.profile.toCollection().first();
      if (!profile) {
        setOpen(true);
        return;
      }

      setDisplayName(profile.name ?? '');
      setUsername(profile.username ?? '');
      setPhoto(profile.photo ?? null);
      if (profile.avatarKey) {
        const avatarUrl = await getAvatarFromCache(profile.avatarKey);
        setPhotoPreview(avatarUrl);
      }
      setIsEdit(true);
    })();
  }, [isEdit, open]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleUsernameChange = (e) => {
    const value = e.target.value.replace('@', '');

    if (!USERNAME_REGEX.test(value)) {
      setUsernameError('Only lowercase letters, numbers, and underscores');
    } else {
      setUsernameError('');
    }

    setUsername(value);
  };

  const handleClick = () => {
    if (!isEdit && step === 1) setStep(2);
    else handleCreateOrupdateProfile();
  };

  const handleCreateOrupdateProfile = async () => {
    let avatarKey = null;

    // Generate avatar key once (or reuse on edit)
    if (photo instanceof File) {
      avatarKey = `avatar_${username}_${dayjs().format('YYYYMMDD_HHmmss_SSS')}`;

      // Save / overwrite avatar in cache
      await saveAvatarToCache(avatarKey, photo);
    }

    if (isEdit) {
      await db.profile.update(username, {
        name: displayName,
        ...(avatarKey && { avatarKey }),
      });
    } else {
      await db.profile.add({
        peerId: username,
        username,
        name: displayName,
        avatarKey,
      });
    }

    setOpen(false);
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth>
      <Box p={5} textAlign='center'>
        {/* ---------------- CREATE (STEP 1) ---------------- */}
        {!isEdit && step === 1 && (
          <>
            <Typography variant='h4' fontWeight={600} mb={1}>
              Welcome to AirChat
            </Typography>
            <Typography color='text.secondary' mb={4}>
              Let’s get you set up
            </Typography>
          </>
        )}
        {!isEdit && step === 2 && (
          <>
            <Typography variant='h4' fontWeight={600} mb={1}>
              Choose a Username
            </Typography>
            <Typography color='text.secondary' mb={4}>
              Optional – This creates your personal peer Id
            </Typography>
          </>
        )}

        {isEdit && (
          <Typography variant='h4' fontWeight={600} mb={4}>
            Edit Profile
          </Typography>
        )}

        {((!isEdit && step === 1) || isEdit) && (
          <>
            <Box mb={3} position='relative' display='inline-block'>
              <Avatar
                src={photoPreview}
                sx={{ width: 96, height: 96, mx: 'auto' }}
              />
              <IconButton
                component='label'
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  bgcolor: 'success.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'success.dark' },
                }}
              >
                <PhotoCamera fontSize='small' />
                <input
                  hidden
                  type='file'
                  accept='image/*'
                  onChange={handlePhotoChange}
                />
              </IconButton>
            </Box>

            <TextField
              fullWidth
              placeholder='Enter your display name'
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': { borderRadius: 10 },
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position='start'>
                      <PersonRounded color='primary' />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </>
        )}

        {((!isEdit && step === 2) || isEdit) && (
          <>
            <TextField
              fullWidth
              placeholder='@myusername'
              value={username}
              disabled={isEdit}
              onChange={handleUsernameChange}
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': { borderRadius: 10 },
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
                usernameError ||
                (isEdit
                  ? 'Username cannot be changed'
                  : 'Others can find you with this username ie. @john, abc123')
              }
            />
            <Typography
              variant='caption'
              color='text.secondary'
              display='block'
              mb={4}
            >
              Others can find you with this username
            </Typography>
          </>
        )}

        <Box display='flex' gap={2}>
          {step === 2 && (
            <Button
              fullWidth
              variant='outlined'
              onClick={() => setStep(1)}
              sx={{ borderRadius: 5 }}
            >
              Back
            </Button>
          )}
          <Button
            fullWidth
            variant='contained'
            color='success'
            sx={{ borderRadius: 5 }}
            onClick={handleClick}
            disabled={!displayName || !!usernameError}
          >
            {isEdit ? 'Save Changes' : 'Continue'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
