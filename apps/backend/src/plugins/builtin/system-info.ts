import { Plugin, PluginContext } from '../types.js';
import { ToolModule } from '../../tools/base.js';
import os from 'os';

const SystemInfoToolModule: ToolModule = {
  name: 'SystemInfo',
  category: 'plugin',
  description: 'System information and diagnostics',
  tools: [
    {
      name: 'system_info',
      description: 'Get system information including CPU, memory, OS, and uptime.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'system_health',
      description: 'Check system health: memory usage, CPU load, and disk status.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ],
  handlers: {
    async system_info() {
      const info = {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        osRelease: os.release(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        totalMemoryGB: (os.totalmem() / 1073741824).toFixed(2),
        freeMemoryGB: (os.freemem() / 1073741824).toFixed(2),
        uptimeHours: (os.uptime() / 3600).toFixed(2),
        nodeVersion: process.version,
        processUptime: (process.uptime() / 3600).toFixed(2) + ' hours',
      };
      return JSON.stringify(info, null, 2);
    },

    async system_health() {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
      const loadAvg = os.loadavg();

      const health = {
        status: Number(memPercent) > 90 ? 'warning' : 'healthy',
        memory: {
          usedGB: (usedMem / 1073741824).toFixed(2),
          totalGB: (totalMem / 1073741824).toFixed(2),
          usedPercent: memPercent + '%',
        },
        cpu: {
          cores: os.cpus().length,
          load1m: loadAvg[0].toFixed(2),
          load5m: loadAvg[1].toFixed(2),
          load15m: loadAvg[2].toFixed(2),
        },
        process: {
          pid: process.pid,
          uptime: (process.uptime() / 3600).toFixed(2) + ' hours',
          memoryMB: (process.memoryUsage().heapUsed / 1048576).toFixed(2),
        },
      };
      return JSON.stringify(health, null, 2);
    },
  },
};

export const SystemInfoPlugin: Plugin = {
  id: 'system-info',
  name: 'System Info',
  version: '1.0.0',
  description: 'System information and health diagnostics tools',
  author: 'Claude Cloud Agent',
  category: 'utilities',
  tools: [SystemInfoToolModule],

  async activate(_context: PluginContext) {
    console.log('[Plugin:SystemInfo] Activated');
  },

  async deactivate() {
    console.log('[Plugin:SystemInfo] Deactivated');
  },
};
