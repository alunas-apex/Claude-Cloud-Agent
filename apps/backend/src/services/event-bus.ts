import { EventEmitter } from 'events';

/**
 * EventBus — Central event system for decoupled component communication.
 *
 * Key events:
 * - 'message:received'   — New message from any channel
 * - 'message:response'   — Assistant response ready
 * - 'message:chunk'      — Streaming response chunk
 * - 'tool:executing'     — Tool call started
 * - 'tool:completed'     — Tool call finished
 * - 'session:created'    — New session started
 * - 'session:updated'    — Session metadata changed
 * - 'cost:incurred'      — API cost recorded
 * - 'agent:delegated'    — Agent team delegation
 * - 'memory:stored'      — New memory persisted
 */
class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(50); // Allow many subscribers
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /** Typed emit helper for common events */
  emitToolStart(data: { sessionId: string; toolName: string; input?: Record<string, unknown> }): void {
    this.emit('tool:executing', data);
  }

  emitToolComplete(data: {
    sessionId: string;
    toolName: string;
    result?: string;
    durationMs: number;
    status: 'success' | 'error';
  }): void {
    this.emit('tool:completed', data);
  }

  emitMessageChunk(data: { sessionId: string; chunk: string; role: string }): void {
    this.emit('message:chunk', data);
  }

  emitCostIncurred(data: {
    sessionId?: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  }): void {
    this.emit('cost:incurred', data);
  }
}

export const eventBus = EventBus.getInstance();
