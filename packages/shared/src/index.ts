// ── Shared Types ──────────────────────────────────────────────────────────────
// Types and constants shared between backend and dashboard

// ── Conversation ──────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface UserRecord {
  userId: string;
  channel: string;
  name?: string;
  createdAt: number;
}

export interface AgentResponse {
  text: string;
  toolCallCount: number;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'archived' | 'error';

export interface Session {
  id: string;
  userId: string;
  channel: string;
  title?: string;
  modelUsed?: string;
  status: SessionStatus;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: number;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool_call' | 'tool_result';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

// ── Tool Execution ────────────────────────────────────────────────────────────

export type ToolExecutionStatus = 'success' | 'error';

export interface ToolExecution {
  id: number;
  sessionId: string;
  messageId?: number;
  toolName: string;
  input?: Record<string, unknown>;
  output?: string;
  durationMs?: number;
  status: ToolExecutionStatus;
  error?: string;
  timestamp: number;
}

// ── Cost Tracking ─────────────────────────────────────────────────────────────

export interface CostEntry {
  id: number;
  sessionId?: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  timestamp: number;
}

// ── Channel Capabilities ──────────────────────────────────────────────────────

export interface ChannelCapabilities {
  maxMessageLength: number;
  supportsMarkdown: boolean;
  supportsStreaming: boolean;
  supportsMedia: boolean;
}

// ── Model Routing ─────────────────────────────────────────────────────────────

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

export interface ModelConfig {
  id: string;
  tier: ModelTier;
  maxTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
}

export const MODELS: Record<ModelTier, ModelConfig> = {
  haiku: {
    id: 'claude-haiku-4-5-20251001',
    tier: 'haiku',
    maxTokens: 4096,
    inputCostPer1k: 0.001,
    outputCostPer1k: 0.005,
  },
  sonnet: {
    id: 'claude-sonnet-4-6',
    tier: 'sonnet',
    maxTokens: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
  },
  opus: {
    id: 'claude-opus-4-6',
    tier: 'opus',
    maxTokens: 8192,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
  },
};

// ── Routing Decision ─────────────────────────────────────────────────────────

export interface RoutingRequest {
  message: string;
  conversationLength: number;
  toolsRequired?: string[];
  channel?: string;
  budgetRemaining?: number;
}

export interface RoutingDecision {
  modelId: string;
  tier: ModelTier;
  maxTokens: number;
  reason: string;
  estimatedInputCost: number;
  estimatedOutputCost: number;
  fallbackChain: string[];
}

// ── Tool Categories ──────────────────────────────────────────────────────────

export type ToolCategory = 'google' | 'utility' | 'mcp' | 'plugin' | 'system' | 'admin' | 'cloud';

// ── Budget ───────────────────────────────────────────────────────────────────

export interface BudgetStatus {
  dailyBudgetUsd: number;
  dailySpentUsd: number;
  dailyRemainingUsd: number;
  sessionBudgetUsd: number;
  sessionSpentUsd: number;
  sessionRemainingUsd: number;
  isOverBudget: boolean;
  autoDowngrade: boolean;
}

// ── Cost Breakdown ───────────────────────────────────────────────────────────

export interface CostBreakdown {
  byModel: Record<string, { tokensIn: number; tokensOut: number; costUsd: number; requests: number }>;
  total: { tokensIn: number; tokensOut: number; costUsd: number; requests: number };
};

// ── WebSocket Events ──────────────────────────────────────────────────────────

export interface WsMessageChunk {
  sessionId: string;
  chunk: string;
  role: string;
}

export interface WsToolEvent {
  sessionId: string;
  toolName: string;
  input?: Record<string, unknown>;
  result?: string;
  durationMs?: number;
}

export interface WsCostUpdate {
  sessionId: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  installedAt: number;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface SettingEntry {
  key: string;
  value: string;
  updatedAt: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_PORT = 3000;
export const DEFAULT_HISTORY_LIMIT = 20;
export const MAX_TOOL_ITERATIONS = 10;
export const MAX_TOOL_RESULT_LENGTH = 2000;
