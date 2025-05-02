#!/bin/bash
# Script to run scrapers independently of the main application
# To be executed by cron on production server

# Log file path
LOG_FILE="/var/log/pawaodds/scrapers.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Make sure log directory exists
mkdir -p $(dirname $LOG_FILE)

# Navigate to application directory (adjust path as needed)
cd /var/www/pawaodds/current

# Log start of scraper run
echo "[$TIMESTAMP] Starting standalone scraper run..." >> $LOG_FILE

# Run the scrapers using tsx
export NODE_ENV=production
/usr/local/bin/tsx scripts/run-scrapers.ts >> $LOG_FILE 2>&1

# Check exit status
if [ $? -eq 0 ]; then
  TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$TIMESTAMP] Scraper run completed successfully" >> $LOG_FILE
else
  TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$TIMESTAMP] Scraper run failed" >> $LOG_FILE
fi