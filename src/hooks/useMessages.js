import { useEffect, useState } from 'react';
import { messagesDB } from '../services/db';

export const useMessages = (peerId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!peerId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    loadMessages();

    // Refresh messages every 2 seconds
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [peerId]);

  const loadMessages = async () => {
    if (!peerId) return;

    const msgs = await messagesDB.getByPeer(peerId);
    setMessages(msgs);
    setLoading(false);
  };

  return { messages, loading, refreshMessages: loadMessages };
};
