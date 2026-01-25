import { Box, useMediaQuery } from '@mui/material';

export default function AppShell({ chatList, chatWindow, showChat }) {
  const isMobile = useMediaQuery('(max-width:768px)');

  if (isMobile) {
    return <Box height='100vh'>{showChat ? chatWindow : chatList}</Box>;
  }

  return (
    <Box display='flex' height='100vh'>
      <Box width={500} borderRight='1px solid #2a3942'>
        {chatList}
      </Box>
      <Box flex={1}>{chatWindow}</Box>
    </Box>
  );
}
