'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface AgentInfo {
  role: string;
  name: string;
  description: string;
  modelTier: string;
  modelId: string;
  status: string;
  tasksCompleted: number;
  toolCategories: string[];
}

interface TaskHistoryItem {
  id: string;
  instruction: string;
  status: string;
  agents: string[];
  durationMs: number;
}

const MODEL_COLORS: Record<string, string> = {
  haiku: 'bg-green-500/20 text-green-400',
  sonnet: 'bg-blue-500/20 text-blue-400',
  opus: 'bg-purple-500/20 text-purple-400',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-green-500',
  busy: 'bg-yellow-500',
  error: 'bg-red-500',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [taskHistory, setTaskHistory] = useState<TaskHistoryItem[]>([]);
  const [instruction, setInstruction] = useState('');
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, t] = await Promise.all([api.agents.list(), api.agents.taskHistory(10)]);
      setAgents(a);
      setTaskHistory(t);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleRun = async () => {
    if (!instruction.trim() || running) return;
    setRunning(true);
    setLastResult(null);
    try {
      const res = await api.agents.run(instruction);
      setLastResult(res.result);
      setInstruction('');
      await refresh();
    } catch (err: any) {
      setLastResult(`Error: ${err.message}`);
    }
    setRunning(false);
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Agent Teams</h2>
      <p className="text-[var(--muted)] text-sm mb-6">Specialized AI agents that collaborate to handle complex tasks</p>

      {/* Run Task */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">Run Agent Task</h3>
        <p className="text-xs text-[var(--muted)] mb-3">
          The Coordinator analyzes your request and delegates to the right specialist(s).
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Describe a task for the agent team..."
            className="flex-1 bg-[var(--background)] border border-[var(--card-border)] rounded-md px-4 py-2.5 text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            disabled={running}
          />
          <button
            onClick={handleRun}
            disabled={running || !instruction.trim()}
            className="px-6 py-2.5 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 disabled:opacity-50 min-w-[100px]"
          >
            {running ? 'Running...' : 'Run'}
          </button>
        </div>
        {lastResult && (
          <div className="mt-4 p-4 bg-[var(--background)] rounded-lg">
            <p className="text-xs text-[var(--muted)] mb-2">Result:</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{lastResult}</p>
          </div>
        )}
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {agents.map((agent) => (
          <div key={agent.role} className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">{agent.name}</h3>
              <span className={`text-xs px-2 py-1 rounded font-medium ${MODEL_COLORS[agent.modelTier] || 'bg-gray-500/20 text-gray-400'}`}>
                {agent.modelTier.charAt(0).toUpperCase() + agent.modelTier.slice(1)}
              </span>
            </div>
            <p className="text-sm text-[var(--muted)] mb-4">{agent.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status] || 'bg-gray-500'}`} />
                <span className="text-xs text-[var(--muted)] capitalize">{agent.status}</span>
              </div>
              <span className="text-xs text-[var(--muted)]">
                {agent.tasksCompleted} task{agent.tasksCompleted !== 1 ? 's' : ''} completed
              </span>
            </div>
            {agent.toolCategories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {agent.toolCategories.map((cat) => (
                  <span key={cat} className="text-[10px] text-[var(--muted)] bg-[var(--background)] px-1.5 py-0.5 rounded">
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Task History */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Task History</h3>
        {taskHistory.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No tasks run yet. Use the form above to send a task to the agent team.</p>
        ) : (
          <div className="space-y-3">
            {taskHistory.map((task) => (
              <div key={task.id} className="bg-[var(--background)] rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{task.instruction}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {task.status}
                      </span>
                      {task.agents.length > 0 && (
                        <span className="text-[10px] text-[var(--muted)]">
                          Agents: {task.agents.join(', ')}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--muted)]">
                        {task.durationMs > 1000 ? `${(task.durationMs / 1000).toFixed(1)}s` : `${task.durationMs}ms`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
