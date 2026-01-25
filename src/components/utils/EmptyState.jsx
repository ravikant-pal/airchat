import { Box, Typography } from '@mui/material';

export default function EmptyState({ text }) {
  return (
    <Box
      flex={1}
      display='flex'
      alignItems='center'
      justifyContent='center'
      textAlign='center'
      color='text.secondary'
      px={3}
    >
      <Typography variant='body2'>{text}</Typography>
    </Box>
  );
}
