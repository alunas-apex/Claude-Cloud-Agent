'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  joinSession: (sessionId: string) => void;
  leaveSession: (sessionId: string) => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(WS_URL, { path: '/ws', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => { socket.disconnect(); };
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.off(event, handler);
  }, []);

  const joinSession = useCallback((sessionId: string) => {
    socketRef.current?.emit('session:join', { sessionId });
  }, []);

  const leaveSession = useCallback((sessionId: string) => {
    socketRef.current?.emit('session:leave', { sessionId });
  }, []);

  return { socket: socketRef.current, connected, on, off, joinSession, leaveSession };
}
