'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface McpServerStatus {
  enabled: boolean;
  toolCount: number;
  sseClients: number;
  transports: string[];
}

interface ExternalServer {
  id: string;
  name: string;
  command?: string;
  url?: string;
  enabled: boolean;
  connected: boolean;
  toolCount: number;
}

const POPULAR_SERVERS = [
  { name: 'Filesystem', pkg: '@modelcontextprotocol/server-filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
  { name: 'GitHub', pkg: '@modelcontextprotocol/server-github', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
  { name: 'Slack', pkg: '@modelcontextprotocol/server-slack', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'] },
  { name: 'PostgreSQL', pkg: '@modelcontextprotocol/server-postgres', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'] },
  { name: 'Brave Search', pkg: '@modelcontextprotocol/server-brave-search', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'] },
  { name: 'Memory', pkg: '@modelcontextprotocol/server-memory', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
  { name: 'Google Drive', pkg: '@modelcontextprotocol/server-gdrive', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gdrive'] },
  { name: 'Playwright', pkg: '@playwright/mcp', command: 'npx', args: ['-y', '@playwright/mcp'] },
];

export default function McpPage() {
  const [serverStatus, setServerStatus] = useState<McpServerStatus | null>(null);
  const [externalServers, setExternalServers] = useState<ExternalServer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState({ id: '', name: '', command: '', args: '', url: '' });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [status, servers] = await Promise.all([
        api.mcp.serverStatus(),
        api.mcp.listServers(),
      ]);
      setServerStatus(status);
      setExternalServers(servers);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleAddServer = async () => {
    if (!newServer.id || !newServer.name) return;
    setLoading(true);
    try {
      await api.mcp.addServer({
        id: newServer.id,
        name: newServer.name,
        command: newServer.command || undefined,
        args: newServer.args ? newServer.args.split(' ') : undefined,
        url: newServer.url || undefined,
        enabled: true,
      });
      setNewServer({ id: '', name: '', command: '', args: '', url: '' });
      setShowAddForm(false);
      await refresh();
    } catch (err: any) {
      alert(`Failed to add server: ${err.message}`);
    }
    setLoading(false);
  };

  const handleQuickAdd = async (server: typeof POPULAR_SERVERS[0]) => {
    const id = server.name.toLowerCase().replace(/\s+/g, '-');
    setLoading(true);
    try {
      await api.mcp.addServer({
        id,
        name: server.name,
        command: server.command,
        args: server.args,
        enabled: true,
      });
      await refresh();
    } catch (err: any) {
      alert(`Failed to add ${server.name}: ${err.message}`);
    }
    setLoading(false);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await api.mcp.toggleServer(id, enabled);
      await refresh();
    } catch {}
  };

  const handleRemove = async (id: string) => {
    try {
      await api.mcp.removeServer(id);
      await refresh();
    } catch {}
  };

  const connectedIds = new Set(externalServers.filter((s) => s.connected).map((s) => s.id));
  const configuredIds = new Set(externalServers.map((s) => s.id));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">MCP Servers</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Manage Model Context Protocol server connections</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 transition-opacity"
        >
          {showAddForm ? 'Cancel' : 'Add MCP Server'}
        </button>
      </div>

      {/* Add Server Form */}
      {showAddForm && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Add External MCP Server</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Server ID</label>
              <input
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-white"
                placeholder="my-server"
                value={newServer.id}
                onChange={(e) => setNewServer({ ...newServer, id: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Display Name</label>
              <input
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-white"
                placeholder="My Server"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Command (stdio)</label>
              <input
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-white"
                placeholder="npx"
                value={newServer.command}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Arguments (space-separated)</label>
              <input
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-white"
                placeholder="-y @modelcontextprotocol/server-xxx"
                value={newServer.args}
                onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--muted)] block mb-1">URL (SSE transport, alternative to command)</label>
              <input
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-white"
                placeholder="http://localhost:8080/sse"
                value={newServer.url}
                onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={handleAddServer}
            disabled={loading || !newServer.id || !newServer.name}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Server'}
          </button>
        </div>
      )}

      {/* Built-in MCP Server */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg mb-6 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Built-in MCP Server</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Exposes all {serverStatus?.toolCount || '--'} registered tools to Claude Desktop and Claude Code via MCP protocol.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatusItem
            label="Status"
            value={serverStatus?.enabled ? 'Active' : 'Inactive'}
            color={serverStatus?.enabled ? 'green' : 'gray'}
          />
          <StatusItem label="Tools" value={String(serverStatus?.toolCount || 0)} color="blue" />
          <StatusItem label="SSE Clients" value={String(serverStatus?.sseClients || 0)} color="purple" />
          <StatusItem label="Transports" value={serverStatus?.transports?.join(', ') || '--'} color="gray" />
        </div>
        <div className="mt-4 p-3 bg-[var(--background)] rounded text-xs text-[var(--muted)] font-mono">
          <p className="mb-1">// Claude Desktop / Code config:</p>
          <p>{`{`}</p>
          <p className="pl-4">{`"mcpServers": {`}</p>
          <p className="pl-8">{`"claude-cloud-agent": {`}</p>
          <p className="pl-12">{`"command": "node",`}</p>
          <p className="pl-12">{`"args": ["apps/backend/dist/mcp-stdio.js"]`}</p>
          <p className="pl-8">{`}`}</p>
          <p className="pl-4">{`}`}</p>
          <p>{`}`}</p>
        </div>
      </div>

      {/* Connected External Servers */}
      {externalServers.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-white mb-4">Connected Servers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {externalServers.map((server) => (
              <div key={server.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white text-sm">{server.name}</h4>
                  <button
                    onClick={() => handleRemove(server.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)] mb-2 font-mono truncate">
                  {server.command || server.url || 'N/A'}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${server.connected ? 'bg-green-500' : server.enabled ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                    <span className="text-xs text-[var(--muted)]">
                      {server.connected ? `Connected (${server.toolCount} tools)` : server.enabled ? 'Connecting...' : 'Disabled'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggle(server.id, !server.enabled)}
                    className={`text-xs ${server.enabled ? 'text-yellow-400' : 'text-green-400'} hover:underline`}
                  >
                    {server.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Available MCP Servers (marketplace) */}
      <h3 className="text-sm font-semibold text-white mb-4">Available MCP Servers</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {POPULAR_SERVERS.map((server) => {
          const id = server.name.toLowerCase().replace(/\s+/g, '-');
          const isConfigured = configuredIds.has(id);
          const isConnected = connectedIds.has(id);
          return (
            <div key={server.pkg} className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
              <h4 className="font-medium text-white text-sm mb-1">{server.name}</h4>
              <p className="text-xs text-[var(--muted)] mb-3 font-mono">{server.pkg}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : isConfigured ? 'bg-yellow-500' : 'bg-gray-500'}`} />
                  <span className="text-xs text-[var(--muted)]">
                    {isConnected ? 'Connected' : isConfigured ? 'Configured' : 'Available'}
                  </span>
                </div>
                {!isConfigured && (
                  <button
                    onClick={() => handleQuickAdd(server)}
                    disabled={loading}
                    className="text-xs text-[var(--accent)] hover:underline disabled:opacity-50"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusItem({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    gray: 'text-gray-400',
    yellow: 'text-yellow-400',
  };
  return (
    <div className="bg-[var(--background)] rounded p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`text-sm font-medium ${colorMap[color] || 'text-white'}`}>{value}</p>
    </div>
  );
}
