import { useEffect } from 'react';
import { useRandomConnect } from '../../contexts/RandomConnectProvider';
import { randomService } from '../../services/randomService';
import { RandomChatView } from './RandomChatView';
import { RandomSearchView } from './RandomSearchView';

export default function RandomScreen({ onBackToChats }) {
  const { phase } = useRandomConnect();

  // Leaving the Random screen disconnects the temp session entirely.
  useEffect(() => () => randomService.leave(), []);

  return phase === 'matched' ? (
    <RandomChatView onBackToChats={onBackToChats} />
  ) : (
    <RandomSearchView onBackToChats={onBackToChats} />
  );
}