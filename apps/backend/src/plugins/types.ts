import { Express, Router } from 'express';
import { ToolModule } from '../tools/base.js';
import { Channel } from '../channels/base.js';
import { ToolRegistry } from '../agent/tool-registry.js';

/**
 * Plugin lifecycle interface.
 * Plugins can provide tools, channels, API routes, and dashboard widgets.
 */
export interface Plugin {
  /** Unique plugin identifier (e.g. 'github-tools', 'web-search') */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Short description */
  description?: string;

  /** Plugin author */
  author?: string;

  /** Plugin category for marketplace grouping */
  category?: 'tools' | 'channels' | 'integrations' | 'utilities';

  /** Called when the plugin is activated */
  activate(context: PluginContext): Promise<void>;

  /** Called when the plugin is deactivated */
  deactivate(): Promise<void>;

  /** Tool modules provided by this plugin */
  tools?: ToolModule[];

  /** Channels provided by this plugin */
  channels?: Channel[];

  /** API routes provided by this plugin */
  registerRoutes?(router: Router): void;
}

/**
 * Context passed to plugins during activation.
 * Provides access to core services without direct coupling.
 */
export interface PluginContext {
  /** Tool registry for registering/querying tools */
  toolRegistry: ToolRegistry;

  /** Express app for registering additional routes */
  app: Express;

  /** Emit events to the EventBus */
  emit: (event: string, data: unknown) => void;

  /** Get a setting value */
  getSetting: (key: string) => string | undefined;

  /** Set a setting value */
  setSetting: (key: string, value: string) => void;
}

/**
 * Plugin metadata stored in database.
 */
export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  installedAt: number;
}

/**
 * Plugin info returned by API.
 */
export interface PluginInfo {
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
