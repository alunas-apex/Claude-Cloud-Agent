'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSessions } from '../../hooks/use-api';
import { useSocket } from '../../hooks/use-socket';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const statusColors: Record<string, string> = {
  active: 'text-green-400',
  archived: 'text-gray-400',
  error: 'text-red-400',
};

const statusDotColors: Record<string, string> = {
  active: 'bg-green-400',
  archived: 'bg-gray-400',
  error: 'bg-red-400',
};

const channelLabels: Record<string, string> = {
  sms: 'SMS',
  twilio: 'SMS',
  web: 'Web',
  telegram: 'Telegram',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  discord: 'Discord',
};

function ChannelBadge({ channel }: { channel: string }) {
  const label = channelLabels[channel.toLowerCase()] || channel;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-[var(--muted)] border border-[var(--card-border)]">
      {label}
    </span>
  );
}

export default function SessionsPage() {
  const { sessions, loading, error, refresh } = useSessions();
  const { on, off } = useSocket();

  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const handleCreated = () => refresh();
    const handleUpdated = () => refresh();

    on('session:created', handleCreated);
    on('session:updated', handleUpdated);

    return () => {
      off('session:created', handleCreated);
      off('session:updated', handleUpdated);
    };
  }, [on, off, refresh]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        !search ||
        (s.title || '').toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase());
      const matchesChannel =
        channelFilter === 'all' ||
        s.channel.toLowerCase() === channelFilter.toLowerCase();
      const matchesStatus =
        statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [sessions, search, channelFilter, statusFilter]);

  const uniqueChannels = useMemo(() => {
    const set = new Set(sessions.map((s) => s.channel.toLowerCase()));
    return Array.from(set);
  }, [sessions]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Sessions</h2>
          <p className="text-[var(--muted)] text-sm mt-1">
            Manage conversation sessions across all channels
          </p>
        </div>
        <button className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 transition-opacity">
          New Session
        </button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg">
        {/* Filters */}
        <div className="p-4 border-b border-[var(--card-border)] flex gap-3">
          <input
            type="text"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-black/30 border border-[var(--card-border)] rounded-md px-3 py-2 text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="bg-black/30 border border-[var(--card-border)] rounded-md px-3 py-2 text-sm text-white"
          >
            <option value="all">All Channels</option>
            {uniqueChannels.map((ch) => (
              <option key={ch} value={ch}>
                {channelLabels[ch] || ch}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/30 border border-[var(--card-border)] rounded-md px-3 py-2 text-sm text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="flex items-center gap-3 text-[var(--muted)] text-sm">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading sessions...
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">
            Failed to load sessions: {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)] text-sm">
            No sessions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-[var(--muted)] text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Tokens (In/Out)
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-[var(--card-border)] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      {session.title || (
                        <span className="text-[var(--muted)] italic">
                          Untitled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChannelBadge channel={session.channel} />
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {session.modelUsed || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 ${statusColors[session.status] || 'text-gray-400'}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusDotColors[session.status] || 'bg-gray-400'}`}
                        />
                        {session.status.charAt(0).toUpperCase() +
                          session.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--muted)] tabular-nums">
                      {session.totalTokensIn.toLocaleString()} /{' '}
                      {session.totalTokensOut.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">
                      ${session.totalCostUsd.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--muted)]">
                      {timeAgo(session.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
