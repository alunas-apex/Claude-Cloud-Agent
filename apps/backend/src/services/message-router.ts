import { IncomingMessage } from '../channels/base.js';
import { Assistant } from '../agent/assistant.js';
import { saveMessage, getHistory, upsertUser } from './database.js';

const HISTORY_LIMIT = 20;

/**
 * MessageRouter is the channel-agnostic core of the agent.
 * It receives a normalized IncomingMessage from any channel,
 * loads conversation history, calls the assistant, saves the response,
 * and returns the reply string — regardless of which channel sent the message.
 */
export class MessageRouter {
  private assistant: Assistant;

  constructor(assistant: Assistant) {
    this.assistant = assistant;
  }

  async handle(msg: IncomingMessage): Promise<string> {
    const { userId, channel, text } = msg;

    // Ensure user record exists
    upsertUser(userId, channel);

    // Handle built-in commands
    const command = text.trim().toLowerCase();
    if (command === '/clear' || command === 'clear history') {
      const { clearHistory } = await import('./database.js');
      clearHistory(userId);
      return 'Conversation history cleared. Starting fresh!';
    }

    // Save the incoming message
    saveMessage(userId, 'user', text, channel);

    // Load recent conversation history
    const history = getHistory(userId, HISTORY_LIMIT);
    // Remove the last message (the one we just saved) since we pass it separately
    const historyWithoutLatest = history.slice(0, -1);

    try {
      const reply = await this.assistant.chat(historyWithoutLatest, text);

      // Save the assistant's reply
      saveMessage(userId, 'assistant', reply, channel);

      return reply;
    } catch (err: any) {
      console.error('[MessageRouter] Agent error:', err);

      const errMsg =
        err?.status === 401
          ? 'Authentication error with AI service. Check ANTHROPIC_API_KEY.'
          : `Sorry, I encountered an error: ${err?.message ?? 'Unknown error'}. Please try again.`;

      saveMessage(userId, 'assistant', errMsg, channel);
      return errMsg;
    }
  }
}
