import { useLiveQuery } from 'dexie-react-hooks';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { db } from '../services/db';
import { randomService } from '../services/randomService';

const RandomConnectContext = createContext(null);

const DEFAULT_CALL = { status: 'idle', mode: null, micOn: false, camOn: false };

export function RandomConnectProvider({ children }) {
  const [phase, setPhase] = useState('idle'); // idle | searching | matched
  const [peerName, setPeerName] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [call, setCall] = useState(DEFAULT_CALL);
  const [incomingCall, setIncomingCall] = useState(null); // {mode} | null
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState(null);
  const errorTimer = useRef(null);

  const myProfile = useLiveQuery(() => db.profile.toCollection().first());
  const isTypingRef = useRef(false);

  const handleEnded = useCallback(() => {
    setCall(DEFAULT_CALL);
    setIncomingCall(null);
    // Detach + stop any remote media we were playing.
    setRemoteStream((prev) => {
      if (prev) prev.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);

  const handleCallState = useCallback(
    (s) => {
      switch (s.type) {
        case 'incoming':
          setIncomingCall({ mode: s.mode });
          break;
        case 'ringing':
          setIncomingCall(null);
          setCall({ status: 'ringing', mode: s.mode, micOn: false, camOn: false });
          break;
        case 'active':
          setIncomingCall(null);
          setCall({
            status: 'active',
            mode: s.mode,
            micOn: true,
            camOn: s.mode === 'video',
            startedAt: Date.now(),
          });
          break;
        case 'ended':
          handleEnded();
          break;
      }
    },
    [handleEnded],
  );

  useEffect(() => {
    randomService.setHandlers({
      onPhase: (p) => {
        setPhase(p);
        if (p !== 'matched') {
          // Leaving/searching resets the ephemeral session + any active call.
          setMessages([]);
          setPeerName(null);
          setIsTyping(false);
          handleEnded();
        }
      },
      onMessage: (msg) =>
        setMessages((m) => [
          ...m,
          {
            id: msg.id,
            sender: 'peer',
            content: msg.text,
            timestamp: msg.timestamp,
            status: 'delivered',
          },
        ]),
      onTyping: setIsTyping,
      onPeerInfo: (info) => setPeerName(info.name || 'Stranger'),
      onCallState: handleCallState,
      onLocalStream: (stream) => setLocalStream(stream),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onError: (msg) => {
        setError(msg);
        if (errorTimer.current) clearTimeout(errorTimer.current);
        errorTimer.current = setTimeout(() => setError(null), 5000);
      },
    });

    return () => {
      randomService.leave();
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const start = useCallback(() => randomService.start(myProfile), [myProfile]);
  const leave = useCallback(() => randomService.leave(), []);
  const next = useCallback(() => randomService.next(), []);

  const sendMessage = useCallback(
    (text) => {
      const ok = randomService.sendMessage(text);
      if (ok) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            sender: 'me',
            content: text,
            timestamp: Date.now(),
            status: 'delivered',
          },
        ]);
      }
    },
    [],
  );

  const sendTyping = useCallback((typing) => {
    if (typing !== isTypingRef.current) {
      isTypingRef.current = typing;
      randomService.sendTyping(typing);
    }
  }, []);

  const requestCall = useCallback((mode) => {
    randomService.requestCall(mode).catch(() => {
      /* surfaced via onError */
    });
  }, []);

  const acceptCall = useCallback((mode) => {
    randomService.acceptCall(mode).catch(() => {
      /* surfaced via onError */
    });
  }, []);

  const declineCall = useCallback(() => randomService.declineCall(), []);
  const endCall = useCallback(() => randomService.endCall(), []);

  const toggleMic = useCallback(() => {
    const enabled = randomService.toggleMic();
    setCall((c) => (c.status === 'active' ? { ...c, micOn: enabled } : c));
  }, []);

  const toggleCam = useCallback(() => {
    const enabled = randomService.toggleCam();
    setCall((c) => (c.status === 'active' ? { ...c, camOn: enabled } : c));
  }, []);

  return (
    <RandomConnectContext.Provider
      value={{
        myProfile,
        phase,
        peerName,
        messages,
        isTyping,
        call,
        incomingCall,
        localStream,
        remoteStream,
        error,
        start,
        leave,
        next,
        sendMessage,
        sendTyping,
        requestCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMic,
        toggleCam,
        clearError: () => setError(null),
      }}
    >
      {children}
    </RandomConnectContext.Provider>
  );
}

export function useRandomConnect() {
  const ctx = useContext(RandomConnectContext);
  if (!ctx) throw new Error('useRandomConnect must be used inside <RandomConnectProvider>');
  return ctx;
}