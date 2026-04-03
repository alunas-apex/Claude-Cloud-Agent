import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { eventBus } from './event-bus.js';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server and wire up EventBus forwarding.
 * Dashboard clients connect here for real-time updates.
 */
export function initWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: ['http://localhost:3001', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
    },
    path: '/ws',
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Allow clients to join session-specific rooms
    socket.on('session:join', ({ sessionId }: { sessionId: string }) => {
      socket.join(`session:${sessionId}`);
      console.log(`[WebSocket] ${socket.id} joined session:${sessionId}`);
    });

    socket.on('session:leave', ({ sessionId }: { sessionId: string }) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  // Forward EventBus events to WebSocket clients
  eventBus.on('message:chunk', (data) => {
    io?.to(`session:${data.sessionId}`).emit('message:chunk', data);
    io?.emit('message:chunk', data); // Also broadcast to all for dashboard
  });

  eventBus.on('tool:executing', (data) => {
    io?.to(`session:${data.sessionId}`).emit('tool:start', data);
    io?.emit('tool:start', data);
  });

  eventBus.on('tool:completed', (data) => {
    io?.to(`session:${data.sessionId}`).emit('tool:complete', data);
    io?.emit('tool:complete', data);
  });

  eventBus.on('cost:incurred', (data) => {
    if (data.sessionId) {
      io?.to(`session:${data.sessionId}`).emit('cost:update', data);
    }
    io?.emit('cost:update', data);
  });

  eventBus.on('session:created', (data) => {
    io?.emit('session:created', data);
  });

  eventBus.on('session:updated', (data) => {
    io?.emit('session:updated', data);
  });

  console.log('[WebSocket] Socket.IO server initialized');
  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
