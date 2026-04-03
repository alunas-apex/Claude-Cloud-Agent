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
  agents: {
    list: () => fetchAPI<Array<{ role: string; name: string; description: string; modelTier: string; modelId: string; status: string; tasksCompleted: number; toolCategories: string[] }>>('/api/agents'),
    get: (role: string) => fetchAPI<any>(`/api/agents/${role}`),
    taskHistory: (limit = 10) => fetchAPI<Array<{ id: string; instruction: string; status: string; agents: string[]; durationMs: number }>>(`/api/agents/tasks/history?limit=${limit}`),
    run: (instruction: string) => fetchAPI<{ ok: boolean; result: string }>('/api/agents/run', { method: 'POST', body: JSON.stringify({ instruction }) }),
  },
  memory: {
    status: () => fetchAPI<{ path: string; exists: boolean; noteCount: number; indexedCount: number; watching: boolean; chromaAvailable: boolean }>('/api/memory/status'),
    search: (q: string, limit = 5) => fetchAPI<Array<{ id: string; content: string; metadata: Record<string, any>; source: string; similarity?: number }>>(`/api/memory/search?q=${encodeURIComponent(q)}&limit=${limit}`),
    recent: (limit = 10) => fetchAPI<Array<{ id: string; content: string; metadata: Record<string, any>; source: string }>>(`/api/memory/recent?limit=${limit}`),
    store: (content: string, title?: string, tags?: string[]) =>
      fetchAPI<{ ok: boolean; id: string }>('/api/memory', { method: 'POST', body: JSON.stringify({ content, title, tags }) }),
  },
  mcp: {
    serverStatus: () => fetchAPI<{ enabled: boolean; toolCount: number; sseClients: number; transports: string[] }>('/api/mcp/server/status'),
    listServers: () => fetchAPI<Array<{ id: string; name: string; command?: string; url?: string; enabled: boolean; connected: boolean; toolCount: number }>>('/api/mcp/servers'),
    addServer: (server: { id: string; name: string; command?: string; args?: string[]; url?: string; env?: Record<string, string>; enabled?: boolean }) =>
      fetchAPI<{ ok: boolean }>('/api/mcp/servers', { method: 'POST', body: JSON.stringify(server) }),
    removeServer: (id: string) => fetchAPI<{ ok: boolean }>(`/api/mcp/servers/${id}`, { method: 'DELETE' }),
    toggleServer: (id: string, enabled: boolean) =>
      fetchAPI<{ ok: boolean }>(`/api/mcp/servers/${id}/toggle`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
  },
  settings: {
    getAll: () => fetchAPI<any[]>('/api/settings'),
    update: (key: string, value: string) => fetchAPI<{ ok: boolean }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    }),
  },
};
