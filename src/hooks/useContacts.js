import { useEffect, useState } from 'react';
import { contactsDB } from '../services/db';
import { p2pService } from '../services/p2p';

export const useContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();

    // Refresh contacts every 3 seconds
    const interval = setInterval(loadContacts, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadContacts = async () => {
    const allContacts = await contactsDB.getAll();

    // Update online status from all connected rooms
    const updatedContacts = allContacts.map((contact) => {
      // Check if peer is online in any room
      const rooms = p2pService.getAllConnectedRooms();
      const isOnline = rooms.some((roomId) =>
        p2pService.isPeerOnlineInRoom(roomId, contact.peerId),
      );

      return {
        ...contact,
        isOnline,
      };
    });

    setContacts(updatedContacts);
    setLoading(false);
  };

  const addContactByRoom = async (roomId) => {
    // Contact will be added automatically when they send handshake
    // Just return success
    return true;
  };

  const removeContact = async (peerId) => {
    await contactsDB.delete(peerId);
    loadContacts();
  };

  return {
    contacts,
    loading,
    addContactByRoom,
    removeContact,
    refreshContacts: loadContacts,
  };
};
