'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  category?: string;
  enabled: boolean;
  active: boolean;
  toolCount: number;
  channelCount: number;
}

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: string;
  installed: boolean;
}

interface ChannelStatus {
  name: string;
  enabled: boolean;
  configured: boolean;
  missingEnvVars: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  tools: 'bg-blue-500/20 text-blue-400',
  channels: 'bg-purple-500/20 text-purple-400',
  integrations: 'bg-cyan-500/20 text-cyan-400',
  utilities: 'bg-amber-500/20 text-amber-400',
};

const CHANNEL_ICONS: Record<string, string> = {
  twilio: 'SMS',
  telegram: 'TG',
  slack: 'SL',
  whatsapp: 'WA',
};

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceItem[]>([]);
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [p, m, c] = await Promise.all([
        api.plugins.list(),
        api.plugins.marketplace(),
        api.channels.list(),
      ]);
      setPlugins(p);
      setMarketplace(m);
      setChannels(c);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const togglePlugin = async (id: string, currentlyEnabled: boolean) => {
    setToggling(id);
    try {
      if (currentlyEnabled) {
        await api.plugins.disable(id);
      } else {
        await api.plugins.enable(id);
      }
      await refresh();
    } catch {}
    setToggling(null);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Plugins & Channels</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Manage plugins, tools, and messaging channels</p>
        </div>
        <button
          onClick={() => setShowMarketplace(!showMarketplace)}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 transition-opacity"
        >
          {showMarketplace ? 'Installed Plugins' : 'Browse Marketplace'}
        </button>
      </div>

      {/* Channel Status */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Messaging Channels</h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          Channels are auto-detected based on configured environment variables.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {channels.map((ch) => (
            <div
              key={ch.name}
              className={`rounded-lg p-4 border ${
                ch.enabled
                  ? 'bg-green-500/5 border-green-500/20'
                  : 'bg-[var(--background)] border-[var(--card-border)]'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  ch.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {CHANNEL_ICONS[ch.name] || ch.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-sm font-medium text-white capitalize">{ch.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${ch.enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-[var(--muted)]">
                  {ch.enabled ? 'Active' : 'Not configured'}
                </span>
              </div>
              {!ch.enabled && ch.missingEnvVars.length > 0 && (
                <p className="text-[10px] text-red-400/70 mt-2">
                  Missing: {ch.missingEnvVars.join(', ')}
                </p>
              )}
            </div>
          ))}
          {channels.length === 0 && (
            <p className="text-sm text-[var(--muted)] col-span-4">No channels detected</p>
          )}
        </div>
      </div>

      {/* Installed Plugins */}
      {!showMarketplace && (
        <>
          <h3 className="text-sm font-semibold text-white mb-4">Installed Plugins</h3>
          {plugins.length === 0 ? (
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-8 text-center">
              <p className="text-[var(--muted)] text-sm">No plugins installed</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plugins.map((plugin) => (
                <div
                  key={plugin.id}
                  className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{plugin.name}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      CATEGORY_COLORS[plugin.category || ''] || 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {plugin.category || 'general'}
                    </span>
                  </div>
                  {plugin.description && (
                    <p className="text-xs text-[var(--muted)] mb-3">{plugin.description}</p>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-[var(--muted)]">v{plugin.version}</span>
                    <div className="flex items-center gap-3">
                      {plugin.toolCount > 0 && (
                        <span className="text-[10px] text-[var(--muted)]">
                          {plugin.toolCount} tool{plugin.toolCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {plugin.channelCount > 0 && (
                        <span className="text-[10px] text-[var(--muted)]">
                          {plugin.channelCount} channel{plugin.channelCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${plugin.active ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-xs text-[var(--muted)]">
                        {plugin.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <button
                      onClick={() => togglePlugin(plugin.id, plugin.enabled)}
                      disabled={toggling === plugin.id}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        plugin.enabled
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      } disabled:opacity-50`}
                    >
                      {toggling === plugin.id ? '...' : plugin.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Marketplace */}
      {showMarketplace && (
        <>
          <h3 className="text-sm font-semibold text-white mb-4">Plugin Marketplace</h3>
          <p className="text-xs text-[var(--muted)] mb-4">
            Discover plugins to extend your agent&apos;s capabilities. Marketplace plugins connect via MCP or are loaded as built-in modules.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketplace.map((item) => (
              <div
                key={item.id}
                className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">{item.name}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${
                    CATEGORY_COLORS[item.category] || 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] mb-4">{item.description}</p>
                <div className="flex justify-end">
                  {item.installed ? (
                    <span className="text-xs text-green-400">Installed</span>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">Available via MCP</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
