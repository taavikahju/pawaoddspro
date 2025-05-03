module.exports = {
  apps: [
    {
      name: 'pawaodds-server',
      script: 'dist/server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        USE_PYTHON_SPORTYBET: 'true',
        PYTHON_SCRAPER_ACTIVE: 'true'
      }
    },
    {
      name: 'pawaodds-scrapers',
      script: 'run-scrapers.sh',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        USE_PYTHON_SPORTYBET: 'true',
        PYTHON_SCRAPER_ACTIVE: 'true'
      }
    }
  ]
};