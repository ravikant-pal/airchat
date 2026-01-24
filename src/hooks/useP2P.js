import { useEffect, useRef, useState } from 'react';
import { contactsDB, messagesDB, roomsDB } from '../services/db';
import { p2pService } from '../services/p2p';

export const useP2P = (profile) => {
  const [connected, setConnected] = useState(false);
  const [connectedRooms, setConnectedRooms] = useState([]);
  const initializedRef = useRef(false);

  const handshakeLock = new Set();

  useEffect(() => {
    if (!profile || initializedRef.current) return;

    initializedRef.current = true;

    // Connect to personal room
    connectToPersonalRoom();

    // Load and connect to all saved rooms
    loadAndConnectRooms();

    // Setup listeners
    const handlePeerJoin = async ({ peerId, roomId }) => {
      // Send handshake
      p2pService.sendHandshake(roomId, {
        displayName: profile.displayName,
        username: profile.username,
        personalRoomId: profile.personalRoomId,
      });

      // Update contact status
      contactsDB.updateStatus(peerId, true);
    };

    const handlePeerLeave = async ({ peerId, roomId }) => {
      console.log(`Peer ${peerId} left room ${roomId}`);
      await contactsDB.updateStatus(peerId, false);
    };

    const handleHandshake = async ({ data, peerId, roomId }) => {
      if (handshakeLock.has(roomId)) return;
      handshakeLock.add(roomId);

      try {
        let existing = await contactsDB.getByRoomId(roomId);
        if (existing) {
          await contactsDB.updateInfo(existing.roomId, {
            peerId,
            displayName: data.displayName,
            username: data.username,
            isOnline: true,
          });
        } else {
          await contactsDB.add({
            peerId,
            displayName: data.displayName,
            username: data.username,
            roomId,
            isOnline: true,
          });
        }
      } finally {
        handshakeLock.delete(roomId);
      }
    };

    const handleReceipt = async ({ data }) => {
      if (data.status === 'delivered') {
        await messagesDB.updateByMessageId(data.messageId, {
          delivered: true,
        });
      }

      if (data.status === 'read') {
        await messagesDB.updateByMessageId(data.messageId, {
          read: true,
        });
      }
    };

    const handleMessage = async ({ data, peerId, roomId }) => {
      if (data.type !== 'message') return;

      await messagesDB.add({
        messageId: data.messageId,
        roomId,
        peerId,
        content: data.content,
        type: data.messageType,
        timestamp: data.timestamp,
        isMine: false,
        delivered: true,
        read: false,
      });

      // 🔔 send delivered receipt
      p2pService.actions.get(roomId)?.sendReceipt({
        messageId: data.messageId,
        status: 'delivered',
      });
    };

    // Register listeners
    p2pService.on('onPeerJoin', handlePeerJoin);
    p2pService.on('onPeerLeave', handlePeerLeave);
    p2pService.on('onHandshake', handleHandshake);
    p2pService.on('onMessage', handleMessage);
    p2pService.on('onReceipt', handleReceipt);

    // Cleanup
    return () => {
      p2pService.off('onPeerJoin', handlePeerJoin);
      p2pService.off('onPeerLeave', handlePeerLeave);
      p2pService.off('onHandshake', handleHandshake);
      p2pService.off('onMessage', handleMessage);
      p2pService.off('onReceipt', handleReceipt);
    };
  }, [profile]);

  const connectToPersonalRoom = async () => {
    if (!profile?.personalRoomId) return;

    p2pService.connectToRoom(profile.personalRoomId, profile);

    // Save personal room
    await roomsDB.add({
      roomId: profile.personalRoomId,
      name: profile.username ? `@${profile.username}` : 'My Room',
      isPersonal: true,
    });

    setConnectedRooms((prev) => [
      ...new Set([...prev, profile.personalRoomId]),
    ]);
    setConnected(true);
  };

  const updateByMessageId = async (messageId, status) => {
    const msg = await db.messages.where('messageId').equals(messageId).first();

    if (msg) {
      await db.messages.update(msg.id, status);
    }
  };

  const loadAndConnectRooms = async () => {
    const rooms = await roomsDB.getAll();

    for (const room of rooms) {
      if (room.roomId !== profile.personalRoomId) {
        p2pService.connectToRoom(room.roomId, profile);
        setConnectedRooms((prev) => [...new Set([...prev, room.roomId])]);
      }
    }
  };

  const connectToRoom = async (roomId, roomName) => {
    p2pService.connectToRoom(roomId, profile);

    // Save room
    await roomsDB.add({
      roomId,
      name: roomName || roomId,
    });

    setConnectedRooms((prev) => [...new Set([...prev, roomId])]);
  };

  const disconnectFromRoom = async (roomId) => {
    p2pService.disconnectFromRoom(roomId);
    await roomsDB.delete(roomId);
    setConnectedRooms((prev) => prev.filter((r) => r !== roomId));
  };

  return {
    connected,
    connectedRooms,
    connectToRoom,
    disconnectFromRoom,
  };
};
