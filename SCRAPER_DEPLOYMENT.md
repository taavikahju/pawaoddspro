# Scraper Deployment Guide

This guide explains how to ensure that scrapers run consistently every 15 minutes, even if the server restarts.

## Deployment Options

### Option 1: Using PM2 (Recommended for Production)

PM2 is a production process manager for Node.js applications that ensures your application stays running.

1. Make sure PM2 is installed:
   ```bash
   npm install -g pm2
   ```

2. Ensure the `run-scrapers.sh` script is executable:
   ```bash
   chmod +x run-scrapers.sh
   ```

3. Start both the server and the standalone scraper with PM2:
   ```bash
   pm2 start ecosystem.prod.config.js
   ```

4. Save the PM2 configuration to ensure it restarts after server reboots:
   ```bash
   pm2 save
   pm2 startup
   ```

5. Follow the instructions output by the `pm2 startup` command.

### Option 2: Using systemd (Linux Servers)

For Linux servers, systemd provides a reliable way to keep processes running.

1. Create a systemd service file for the standalone scraper:
   ```bash
   sudo nano /etc/systemd/system/pawaodds-scrapers.service
   ```

2. Add the following content:
   ```
   [Unit]
   Description=PawaOdds Scrapers Service
   After=network.target

   [Service]
   User=<your-user>
   WorkingDirectory=/path/to/your/app
   ExecStart=/bin/bash /path/to/your/app/run-scrapers.sh
   Restart=always
   RestartSec=30
   StandardOutput=syslog
   StandardError=syslog
   SyslogIdentifier=pawaodds-scrapers

   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl enable pawaodds-scrapers
   sudo systemctl start pawaodds-scrapers
   ```

4. Check status with:
   ```bash
   sudo systemctl status pawaodds-scrapers
   ```

### Option 3: Using Replit's Built-in Keep Alive

For Replit deployments, you can use Replit's built-in capabilities.

1. Make sure your Replit project is configured as "Always On" in the project settings.

2. In `.replit` file, ensure the "run" command executes both the server and the standalone scraper:
   ```
   run = "node dist/server/index.js & node dist/server/standalone-scraper.js"
   ```

3. Use the standalone scraper implementation which keeps itself running.

## How It Works

The standalone scraper (`server/standalone-scraper.ts`) is designed with resilience in mind:

1. **Scheduled Execution**: Runs scrapers every 15 minutes
2. **Error Handling**: Uses exponential backoff to retry after failures
3. **Persistent State**: Tracks successful scraper runs by writing to a file
4. **Self-Healing**: Restarts automatically if it crashes

## Monitoring

To verify the scrapers are running correctly:

1. Check the logs:
   ```bash
   # For PM2
   pm2 logs pawaodds-scrapers
   
   # For systemd
   sudo journalctl -u pawaodds-scrapers
   ```

2. Check the last successful run timestamp:
   ```bash
   cat last_successful_scrape.txt
   ```

## Troubleshooting

If scrapers are not running:

1. Verify the process is running:
   ```bash
   # For PM2
   pm2 status
   
   # For systemd
   sudo systemctl status pawaodds-scrapers
   ```

2. Check the logs for errors as shown above

3. Ensure the correct environment variables are set

4. If needed, manually restart the scraper service:
   ```bash
   # For PM2
   pm2 restart pawaodds-scrapers
   
   # For systemd
   sudo systemctl restart pawaodds-scrapers
   ```