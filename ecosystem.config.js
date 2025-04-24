module.exports = {
  apps: [
    {
      name: "pawaodds",
      script: "tsx",
      args: "server/index.ts",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      },
      watch: false,
      max_memory_restart: "1G",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      combine_logs: true,
      cron_restart: "0 4 * * *", // Restart daily at 4 AM to refresh memory
      autorestart: true,
      exec_mode: "fork"
    }
  ]
};