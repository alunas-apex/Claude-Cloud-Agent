/**
 * PM2 Ecosystem Configuration
 *
 * Start the agent:  pm2 start ecosystem.config.js
 * View logs:        pm2 logs claude-agent
 * Restart:          pm2 restart claude-agent
 * Stop:             pm2 stop claude-agent
 * Auto-start boot:  pm2 startup && pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'claude-agent',
      script: 'src/index.ts',
      interpreter: 'tsx',
      cwd: __dirname,
      env_file: '.env',
      watch: false,
      instances: 1,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
    },
  ],
};
