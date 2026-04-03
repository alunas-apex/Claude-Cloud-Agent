'use client';

import { useState, useEffect, useCallback } from 'react';
import { useHealth, useSessions, useTodayCost, useCostBreakdown, useBudgetStatus } from '../hooks/use-api';
import { useSocket } from '../hooks/use-socket';

interface ActivityEvent {
  id: string;
  type: string;
  summary: string;
  timestamp: Date;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const MODEL_DISPLAY: Record<string, { label: string; color: string }> = {
  'claude-haiku-4-5-20251001': { label: 'Haiku 4.5', color: 'text-green-400' },
  'claude-sonnet-4-6': { label: 'Sonnet 4.6', color: 'text-blue-400' },
  'claude-opus-4-6': { label: 'Opus 4.6', color: 'text-purple-400' },
};

export default function DashboardHome() {
  const { data: health, error: healthError } = useHealth(10000);
  const { sessions, loading: sessionsLoading } = useSessions(5000);
  const todayCost = useTodayCost(10000);
  const costBreakdown = useCostBreakdown(10000);
  const budgetStatus = useBudgetStatus(10000);
  const { connected, on, off } = useSocket();
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const addEvent = useCallback((type: string, summary: string) => {
    setEvents((prev) => {
      const next = [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, summary, timestamp: new Date() },
        ...prev,
      ];
      return next.slice(0, 10);
    });
  }, []);

  useEffect(() => {
    const handleToolStart = (data: any) => {
      addEvent('tool:start', `Tool started: ${data?.toolName || data?.name || 'unknown'}`);
    };
    const handleToolComplete = (data: any) => {
      const duration = data?.durationMs ? ` (${data.durationMs}ms)` : '';
      addEvent('tool:complete', `Tool completed: ${data?.toolName || data?.name || 'unknown'}${duration}`);
    };
    const handleCostUpdate = (data: any) => {
      const model = data?.model || 'unknown';
      const display = MODEL_DISPLAY[model]?.label || model;
      const amount = data?.costUsd != null ? ` $${Number(data.costUsd).toFixed(4)}` : '';
      addEvent('cost:update', `${display}${amount}`);
    };
    const handleSessionCreated = (data: any) => {
      addEvent('session:created', `New session: ${data?.channel || 'unknown'}`);
    };
    const handleSessionUpdated = (data: any) => {
      addEvent('session:updated', `Session updated: ${data?.sessionId?.slice(0, 8) || 'unknown'}`);
    };

    on('tool:start', handleToolStart);
    on('tool:complete', handleToolComplete);
    on('cost:update', handleCostUpdate);
    on('session:created', handleSessionCreated);
    on('session:updated', handleSessionUpdated);

    return () => {
      off('tool:start', handleToolStart);
      off('tool:complete', handleToolComplete);
      off('cost:update', handleCostUpdate);
      off('session:created', handleSessionCreated);
      off('session:updated', handleSessionUpdated);
    };
  }, [on, off, addEvent]);

  const activeSessions = sessionsLoading ? '--' : String(sessions.length);
  const channelCount = health ? String(health.channels?.length ?? 0) : '--';
  const costDisplay = `$${todayCost.toFixed(2)}`;
  const uptimeDisplay = health ? formatUptime(health.uptime) : '--';

  const backendStatus: 'online' | 'offline' = health && !healthError ? 'online' : 'offline';
  const wsStatus: 'online' | 'offline' = connected ? 'online' : 'offline';
  const dbStatus: 'online' | 'offline' = health && !healthError ? 'online' : 'offline';

  // Budget bar percentage
  const budgetPct = budgetStatus
    ? Math.min(100, (budgetStatus.dailySpentUsd / budgetStatus.dailyBudgetUsd) * 100)
    : 0;
  const budgetColor = budgetPct > 90 ? 'bg-red-500' : budgetPct > 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
      <p className="text-[var(--muted)] mb-8">Claude Cloud Agent Command Center</p>

      {/* Top stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Active Sessions" value={activeSessions} subtitle="Across all channels" />
        <StatCard title="Channels Active" value={channelCount} subtitle={health ? health.channels.join(', ') || 'None' : 'Connecting...'} />
        <StatCard title="Today's Cost" value={costDisplay} subtitle="Across all models" />
        <StatCard title="Uptime" value={uptimeDisplay} subtitle="Since last restart" />
      </div>

      {/* Model Routing & Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title="Model Usage Breakdown">
          {costBreakdown && Object.keys(costBreakdown.byModel).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(costBreakdown.byModel).map(([modelId, data]) => {
                const display = MODEL_DISPLAY[modelId] || { label: modelId, color: 'text-gray-400' };
                const pct = costBreakdown.total.requests > 0
                  ? Math.round((data.requests / costBreakdown.total.requests) * 100) : 0;
                return (
                  <div key={modelId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${display.color}`}>{display.label}</span>
                      <span className="text-gray-400">{data.requests} requests</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                      <span>In: {formatTokens(data.tokensIn)}</span>
                      <span>Out: {formatTokens(data.tokensOut)}</span>
                      <span>{formatCost(data.costUsd)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${display.color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-[var(--card-border)] pt-2 mt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Total</span>
                  <span className="text-white font-medium">{formatCost(costBreakdown.total.costUsd)} ({costBreakdown.total.requests} requests)</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No API calls recorded yet. Model usage will appear here as requests are processed.</p>
          )}
        </Card>

        <Card title="Budget Status">
          {budgetStatus ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">Daily Budget</span>
                  <span className="text-white">${budgetStatus.dailySpentUsd.toFixed(2)} / ${budgetStatus.dailyBudgetUsd.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className={`h-2 rounded-full ${budgetColor} transition-all`} style={{ width: `${budgetPct}%` }} />
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">${budgetStatus.dailyRemainingUsd.toFixed(2)} remaining</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--background)] rounded p-3">
                  <p className="text-xs text-[var(--muted)]">Session Budget</p>
                  <p className="text-lg font-medium text-white">${budgetStatus.sessionBudgetUsd.toFixed(2)}</p>
                </div>
                <div className="bg-[var(--background)] rounded p-3">
                  <p className="text-xs text-[var(--muted)]">Auto-Downgrade</p>
                  <p className={`text-lg font-medium ${budgetStatus.autoDowngrade ? 'text-green-400' : 'text-gray-500'}`}>
                    {budgetStatus.autoDowngrade ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>

              {budgetStatus.isOverBudget && (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <p className="text-sm text-red-400 font-medium">Budget Exceeded</p>
                  <p className="text-xs text-red-400/70">Auto-downgrading to cheaper models to control costs.</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Loading budget information...</p>
          )}
        </Card>
      </div>

      {/* Activity & Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent Activity">
          {events.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {connected
                ? 'Listening for events... Activity will appear here in real time.'
                : 'Waiting for WebSocket connection to stream live events.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {events.map((evt) => (
                <div key={evt.id} className="flex items-start gap-3 text-sm">
                  <EventBadge type={evt.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 truncate">{evt.summary}</p>
                    <p className="text-xs text-[var(--muted)]">{evt.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="System Health">
          <div className="space-y-3">
            <HealthRow label="Backend Server" status={backendStatus} />
            <HealthRow label="WebSocket" status={wsStatus} />
            <HealthRow label="Database (SQLite)" status={dbStatus} />
            <HealthRow label="Model Router" status={backendStatus} detail="Haiku / Sonnet / Opus" />
            <HealthRow label="MCP Server" status="planned" />
            <HealthRow label="Obsidian Vault" status="planned" />
          </div>
          {healthError && (
            <p className="text-xs text-red-400 mt-4">Backend error: {healthError}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
      <p className="text-xs text-[var(--muted)] uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-[var(--muted)] mt-1">{subtitle}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}

function HealthRow({ label, status, detail }: { label: string; status: string; detail?: string }) {
  const color =
    status === 'online' ? 'bg-green-500'
    : status === 'offline' ? 'bg-red-500'
    : 'bg-yellow-500';
  const displayStatus = status === 'planned' ? 'planned' : status;
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-gray-300">{label}</span>
        {detail && <span className="text-xs text-[var(--muted)] ml-2">({detail})</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-[var(--muted)] capitalize">{displayStatus}</span>
      </div>
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  let color = 'bg-blue-500/20 text-blue-400';
  let label = 'event';

  if (type === 'tool:start') {
    color = 'bg-yellow-500/20 text-yellow-400';
    label = 'tool';
  } else if (type === 'tool:complete') {
    color = 'bg-green-500/20 text-green-400';
    label = 'tool';
  } else if (type === 'cost:update') {
    color = 'bg-purple-500/20 text-purple-400';
    label = 'cost';
  } else if (type.startsWith('session:')) {
    color = 'bg-blue-500/20 text-blue-400';
    label = 'session';
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${color} flex-shrink-0 mt-0.5`}>
      {label}
    </span>
  );
}
