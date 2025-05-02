module.exports = {
  apps: [
    {
      name: 'pawaodds',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'pawaodds-scrapers',
      script: 'scripts/run-scrapers.ts',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'tsx',
      autorestart: true,
      watch: false,
      cron_restart: '*/30 * * * *', // Restart every 30 minutes
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: '/var/log/pawaodds/scrapers-out.log',
      error_file: '/var/log/pawaodds/scrapers-error.log',
    }
  ],
};