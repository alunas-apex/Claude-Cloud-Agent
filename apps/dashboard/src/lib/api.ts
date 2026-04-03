const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  health: () => fetchAPI<{ status: string; version: string; uptime: number; channels: string[] }>('/health'),
  sessions: {
    list: (limit = 50, offset = 0) => fetchAPI<any[]>(`/api/sessions?limit=${limit}&offset=${offset}`),
    get: (id: string) => fetchAPI<any>(`/api/sessions/${id}`),
  },
  tools: {
    executions: (limit = 50, offset = 0) => fetchAPI<any[]>(`/api/tools/executions?limit=${limit}&offset=${offset}`),
  },
  cost: {
    today: () => fetchAPI<{ costUsd: number }>('/api/cost/today'),
    breakdown: () => fetchAPI<{
      byModel: Record<string, { tokensIn: number; tokensOut: number; costUsd: number; requests: number }>;
      total: { tokensIn: number; tokensOut: number; costUsd: number; requests: number };
    }>('/api/cost/breakdown'),
  },
  budget: {
    status: (sessionId?: string) => fetchAPI<{
      dailyBudgetUsd: number; dailySpentUsd: number; dailyRemainingUsd: number;
      sessionBudgetUsd: number; sessionSpentUsd: number; sessionRemainingUsd: number;
      isOverBudget: boolean; autoDowngrade: boolean;
    }>(`/api/budget${sessionId ? `?sessionId=${sessionId}` : ''}`),
  },
  model: {
    route: (message: string, conversationLength = 0) => fetchAPI<{
      modelId: string; tier: string; maxTokens: number; reason: string;
      estimatedInputCost: number; estimatedOutputCost: number; fallbackChain: string[];
    }>(`/api/model/route?message=${encodeURIComponent(message)}&conversationLength=${conversationLength}`),
  },
  settings: {
    getAll: () => fetchAPI<any[]>('/api/settings'),
    update: (key: string, value: string) => fetchAPI<{ ok: boolean }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    }),
  },
};
