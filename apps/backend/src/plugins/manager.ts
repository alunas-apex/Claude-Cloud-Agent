import { Express, Router } from 'express';
import { Plugin, PluginContext, PluginInfo, PluginRecord } from './types.js';
import { ToolRegistry } from '../agent/tool-registry.js';
import { eventBus } from '../services/event-bus.js';

/**
 * PluginManager — Loads, manages, and orchestrates plugins.
 *
 * Plugins can contribute tools, channels, and API routes.
 * Plugin state (enabled/disabled) persists in SQLite.
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private activePlugins: Set<string> = new Set();
  private toolRegistry: ToolRegistry;
  private app: Express | null = null;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  /**
   * Initialize the plugin manager with the Express app.
   * Loads plugin state from database and activates enabled plugins.
   */
  async initialize(app: Express): Promise<void> {
    this.app = app;

    // Load plugin records from DB
    const { getPluginRecords } = await import('../services/database.js');
    const records = getPluginRecords();

    // Activate enabled plugins that are registered
    for (const record of records) {
      const plugin = this.plugins.get(record.id);
      if (plugin && record.enabled) {
        try {
          await this.activatePlugin(plugin);
        } catch (err: any) {
          console.warn(`[PluginManager] Failed to activate plugin "${record.id}": ${err.message}`);
        }
      }
    }

    console.log(`[PluginManager] Initialized — ${this.plugins.size} registered, ${this.activePlugins.size} active`);
  }

  /**
   * Register a plugin (does not activate it).
   */
  register(plugin: Plugin): void {
    this.plugins.set(plugin.id, plugin);

    // Ensure DB record exists
    this.ensureDbRecord(plugin);

    eventBus.emit('plugin:registered', { id: plugin.id, name: plugin.name });
  }

  /**
   * Enable and activate a plugin.
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);

    if (this.activePlugins.has(pluginId)) return; // Already active

    await this.activatePlugin(plugin);

    const { setPluginEnabled } = await import('../services/database.js');
    setPluginEnabled(pluginId, true);

    eventBus.emit('plugin:enabled', { id: pluginId });
  }

  /**
   * Disable and deactivate a plugin.
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);

    if (!this.activePlugins.has(pluginId)) return; // Already inactive

    try {
      await plugin.deactivate();
    } catch (err: any) {
      console.warn(`[PluginManager] Error deactivating "${pluginId}": ${err.message}`);
    }

    this.activePlugins.delete(pluginId);

    const { setPluginEnabled } = await import('../services/database.js');
    setPluginEnabled(pluginId, false);

    eventBus.emit('plugin:disabled', { id: pluginId });
  }

  /**
   * Get info about all registered plugins.
   */
  getPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values()).map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      category: p.category,
      enabled: this.activePlugins.has(p.id),
      active: this.activePlugins.has(p.id),
      toolCount: p.tools?.reduce((sum, m) => sum + m.tools.length, 0) ?? 0,
      channelCount: p.channels?.length ?? 0,
    }));
  }

  /**
   * Get info about a specific plugin.
   */
  getPlugin(pluginId: string): PluginInfo | undefined {
    const p = this.plugins.get(pluginId);
    if (!p) return undefined;
    return {
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      category: p.category,
      enabled: this.activePlugins.has(p.id),
      active: this.activePlugins.has(p.id),
      toolCount: p.tools?.reduce((sum, m) => sum + m.tools.length, 0) ?? 0,
      channelCount: p.channels?.length ?? 0,
    };
  }

  /**
   * Get marketplace-style listing of available plugins.
   */
  getMarketplace(): Array<{ id: string; name: string; description: string; category: string; installed: boolean }> {
    return MARKETPLACE_PLUGINS.map((mp) => ({
      ...mp,
      installed: this.plugins.has(mp.id),
    }));
  }

  private async activatePlugin(plugin: Plugin): Promise<void> {
    if (!this.app) throw new Error('PluginManager not initialized — call initialize() first');

    const context: PluginContext = {
      toolRegistry: this.toolRegistry,
      app: this.app,
      emit: (event, data) => eventBus.emit(event, data),
      getSetting: (key) => {
        // Synchronous import won't work; use cached import
        try {
          const db = require('../services/database.js');
          return db.getSetting(key);
        } catch {
          return undefined;
        }
      },
      setSetting: (key, value) => {
        try {
          const db = require('../services/database.js');
          db.setSetting(key, value);
        } catch {
          // Silently fail
        }
      },
    };

    // Register tool modules
    if (plugin.tools) {
      for (const toolModule of plugin.tools) {
        this.toolRegistry.register(toolModule);
      }
    }

    // Register API routes
    if (plugin.registerRoutes) {
      const router = Router();
      plugin.registerRoutes(router);
      this.app.use(`/api/plugins/${plugin.id}`, router);
    }

    // Activate the plugin
    await plugin.activate(context);

    this.activePlugins.add(plugin.id);
    console.log(`[PluginManager] Activated plugin "${plugin.name}" v${plugin.version}`);
  }

  private async ensureDbRecord(plugin: Plugin): Promise<void> {
    try {
      const { upsertPlugin } = await import('../services/database.js');
      upsertPlugin(plugin.id, plugin.name, plugin.version);
    } catch {
      // DB not ready yet — will be created on initialize()
    }
  }

  /**
   * Close all active plugins.
   */
  async closeAll(): Promise<void> {
    for (const pluginId of this.activePlugins) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        try {
          await plugin.deactivate();
        } catch {
          // Ignore errors during shutdown
        }
      }
    }
    this.activePlugins.clear();
  }
}

/**
 * Marketplace plugin catalog — curated list of recommended plugins.
 * These are not installed by default but can be added by users.
 */
const MARKETPLACE_PLUGINS = [
  {
    id: 'github-tools',
    name: 'GitHub Tools',
    description: 'Create issues, manage PRs, search repositories via GitHub API',
    category: 'integrations',
  },
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search the web using Brave Search or Google Custom Search',
    category: 'tools',
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and manage files on the server filesystem',
    category: 'tools',
  },
  {
    id: 'browser-automation',
    name: 'Browser Automation',
    description: 'Automate web interactions using Playwright MCP server',
    category: 'tools',
  },
  {
    id: 'database-query',
    name: 'Database Query',
    description: 'Query PostgreSQL, MySQL, or SQLite databases directly',
    category: 'tools',
  },
  {
    id: 'discord-channel',
    name: 'Discord Channel',
    description: 'Chat with the agent via Discord bot',
    category: 'channels',
  },
  {
    id: 'email-channel',
    name: 'Email Channel',
    description: 'Direct email integration via IMAP/SMTP',
    category: 'channels',
  },
  {
    id: 'notion-sync',
    name: 'Notion Sync',
    description: 'Sync agent memory with Notion databases and pages',
    category: 'integrations',
  },
  {
    id: 'image-generation',
    name: 'Image Generation',
    description: 'Generate images using DALL-E, Stable Diffusion, or Flux',
    category: 'utilities',
  },
  {
    id: 'code-interpreter',
    name: 'Code Interpreter',
    description: 'Execute Python code in a sandboxed environment',
    category: 'utilities',
  },
];
