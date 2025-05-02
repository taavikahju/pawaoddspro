# Production Scraper Setup Guide

This guide explains how to set up the scrapers to run on your production server independently of the development environment.

## Option 1: Using Cron Jobs

Cron is the traditional Unix scheduler and is reliable for running tasks at specified intervals.

### Step 1: Upload the scripts

Make sure the following files are on your production server:
- `scripts/run-scrapers.ts` - The standalone scraper script
- `scripts/run-scrapers.sh` - The bash wrapper script
- `scripts/crontab-entry.txt` - The crontab entry
- `scripts/install-cron.sh` - Script to install the crontab entry

### Step 2: Install the cron job

SSH into your production server and run:

```bash
cd /var/www/pawaodds/current
chmod +x scripts/install-cron.sh
sudo ./scripts/install-cron.sh
```

This will add the cron job to run every 30 minutes.

### Step 3: Verify installation

Check that the cron job is installed:

```bash
crontab -l
```

You should see an entry like:
```
*/30 * * * * /var/www/pawaodds/current/scripts/run-scrapers.sh
```

### Step 4: Monitor scraper logs

Check the logs to verify that scrapers are running:

```bash
tail -f /var/log/pawaodds/scrapers.log
```

## Option 2: Using PM2

PM2 is a process manager for Node.js applications that can also handle scheduled tasks.

### Step 1: Make sure PM2 is installed

```bash
npm install -g pm2
```

### Step 2: Update your ecosystem.config.js file

The ecosystem.config.js file has been updated to include a separate process for the scrapers.

### Step 3: Start the scrapers with PM2

```bash
cd /var/www/pawaodds/current
pm2 start ecosystem.config.js
```

This will start both the main application and the scraper process.

### Step 4: Save the PM2 configuration

```bash
pm2 save
```

### Step 5: Monitor the scrapers

```bash
pm2 logs pawaodds-scrapers
```

## Troubleshooting

### Issue: Scrapers aren't running

Check:
1. Is the cron service running? `systemctl status cron`
2. Are there any errors in the logs? `tail -f /var/log/pawaodds/scrapers.log`
3. Do the script paths in crontab match the actual file locations?
4. Does the user running the cron job have the necessary permissions?

### Issue: Scripts run but no data is collected

Check:
1. Database connection issues in the logs
2. Network connectivity to bookmaker sites
3. Scraper-specific errors in the logs
4. Environment variables - make sure DATABASE_URL is correctly set

### Issue: PM2 processes stopping unexpectedly

Check:
1. Memory usage - increase max_memory_restart if needed
2. Error logs - look for runtime errors
3. Restart history - `pm2 logs pawaodds-scrapers`