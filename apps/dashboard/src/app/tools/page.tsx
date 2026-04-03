'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToolExecutions } from '../../hooks/use-api';
import { useSocket } from '../../hooks/use-socket';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface ToolExecution {
  id: string;
  toolName: string;
  sessionId: string;
  status: 'success' | 'error' | 'running';
  durationMs?: number;
  input?: any;
  output?: any;
  error?: string;
  timestamp: number;
}

export default function ToolsPage() {
  const { executions, loading, refresh } = useToolExecutions();
  const { on, off, connected } = useSocket();
  const [realtimeExecutions, setRealtimeExecutions] = useState<ToolExecution[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Merge realtime executions with API data, deduplicating by id
  const allExecutions: ToolExecution[] = (() => {
    const seen = new Set<string>();
    const merged: ToolExecution[] = [];
    for (const exec of realtimeExecutions) {
      if (!seen.has(exec.id)) {
        seen.add(exec.id);
        merged.push(exec);
      }
    }
    for (const exec of executions) {
      if (!seen.has(exec.id)) {
        seen.add(exec.id);
        merged.push(exec);
      }
    }
    return merged;
  })();

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleToolStart = (data: any) => {
      const exec: ToolExecution = {
        id: data.id || `rt-${Date.now()}`,
        toolName: data.toolName || data.tool_name || 'unknown',
        sessionId: data.sessionId || data.session_id || '',
        status: 'running',
        input: data.input,
        timestamp: data.timestamp || Math.floor(Date.now() / 1000),
      };
      setRealtimeExecutions(prev => [exec, ...prev]);
    };

    const handleToolComplete = (data: any) => {
      const exec: ToolExecution = {
        id: data.id || `rt-${Date.now()}`,
        toolName: data.toolName || data.tool_name || 'unknown',
        sessionId: data.sessionId || data.session_id || '',
        status: data.error ? 'error' : 'success',
        durationMs: data.durationMs || data.duration_ms,
        input: data.input,
        output: data.output,
        error: data.error,
        timestamp: data.timestamp || Math.floor(Date.now() / 1000),
      };
      setRealtimeExecutions(prev => {
        // Replace running entry with same id, or prepend
        const idx = prev.findIndex(e => e.id === exec.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = exec;
          return updated;
        }
        return [exec, ...prev];
      });
      // Also refresh from API to stay in sync
      refresh();
    };

    on('tool:start', handleToolStart);
    on('tool:complete', handleToolComplete);

    return () => {
      off('tool:start', handleToolStart);
      off('tool:complete', handleToolComplete);
    };
  }, [on, off, refresh]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-white">Tools</h2>
        {connected && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        )}
      </div>
      <p className="text-[var(--muted)] text-sm mb-8">View registered tools and execution history</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel: Tool Registry */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
            <div className="p-4 border-b border-[var(--card-border)]">
              <h3 className="text-sm font-semibold text-white">Tool Registry</h3>
              <p className="text-xs text-[var(--muted)] mt-1">41 tools registered</p>
            </div>
            <div className="p-4 space-y-2">
              <ToolCategory name="Google Workspace" count={11} />
              <ToolCategory name="GCP" count={16} />
              <ToolCategory name="Admin" count={13} />
              <ToolCategory name="Utility" count={1} />
              <ToolCategory name="MCP (External)" count={0} />
              <ToolCategory name="Plugins" count={0} />
            </div>
          </div>
        </div>

        {/* Right panel: Execution Log */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
            <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Execution Log</h3>
              <span className="text-xs text-[var(--muted)]">
                {allExecutions.length} execution{allExecutions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[var(--muted)] text-sm mt-3">Loading executions...</p>
              </div>
            ) : allExecutions.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted)] text-sm">
                No tool executions recorded yet
              </div>
            ) : (
              <div className="divide-y divide-[var(--card-border)]">
                {allExecutions.map((exec) => (
                  <div key={exec.id} className="hover:bg-white/[0.02] transition-colors">
                    <button
                      onClick={() => toggleExpanded(exec.id)}
                      className="w-full text-left p-4 flex items-center gap-3"
                    >
                      {/* Expand indicator */}
                      <svg
                        className={`w-3 h-3 text-[var(--muted)] transition-transform flex-shrink-0 ${
                          expandedIds.has(exec.id) ? 'rotate-90' : ''
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                          clipRule="evenodd"
                        />
                      </svg>

                      {/* Tool name */}
                      <span className="font-semibold text-sm text-white truncate min-w-0 flex-shrink-0">
                        {exec.toolName}
                      </span>

                      {/* Status badge */}
                      <StatusBadge status={exec.status} />

                      {/* Duration */}
                      {exec.durationMs != null && (
                        <span className="text-xs text-[var(--muted)] flex-shrink-0">
                          {exec.durationMs}ms
                        </span>
                      )}

                      {/* Spacer */}
                      <span className="flex-1" />

                      {/* Session ID */}
                      {exec.sessionId && (
                        <span className="text-xs text-[var(--muted)] font-mono flex-shrink-0">
                          {exec.sessionId.slice(0, 8)}
                        </span>
                      )}

                      {/* Timestamp */}
                      <span className="text-xs text-[var(--muted)] flex-shrink-0">
                        {timeAgo(exec.timestamp)}
                      </span>
                    </button>

                    {/* Expanded detail */}
                    {expandedIds.has(exec.id) && (
                      <div className="px-4 pb-4 pl-10 space-y-3">
                        {exec.input != null && (
                          <div>
                            <p className="text-xs font-medium text-[var(--muted)] mb-1">Input</p>
                            <pre className="text-xs text-gray-300 bg-black/30 rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
                              {typeof exec.input === 'string'
                                ? exec.input
                                : JSON.stringify(exec.input, null, 2)}
                            </pre>
                          </div>
                        )}
                        {exec.output != null && (
                          <div>
                            <p className="text-xs font-medium text-[var(--muted)] mb-1">Output</p>
                            <pre className="text-xs text-gray-300 bg-black/30 rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
                              {typeof exec.output === 'string'
                                ? exec.output
                                : JSON.stringify(exec.output, null, 2)}
                            </pre>
                          </div>
                        )}
                        {exec.error && (
                          <div>
                            <p className="text-xs font-medium text-red-400 mb-1">Error</p>
                            <pre className="text-xs text-red-300 bg-red-950/30 rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
                              {exec.error}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolCategory({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-white/5 cursor-pointer">
      <span className="text-sm text-gray-300">{name}</span>
      <span className="text-xs text-[var(--muted)] bg-white/5 px-2 py-0.5 rounded">{count}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: 'success' | 'error' | 'running' }) {
  const styles = {
    success: 'bg-green-500/15 text-green-400 border-green-500/30',
    error: 'bg-red-500/15 text-red-400 border-red-500/30',
    running: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  };

  const labels = {
    success: 'Success',
    error: 'Error',
    running: 'Running...',
  };

  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
