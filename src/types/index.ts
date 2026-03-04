// Shared TypeScript interfaces used across the project

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface UserRecord {
  phone: string;
  name?: string;
  createdAt: number;
}

export interface AgentResponse {
  text: string;
  toolCallCount: number;
}
