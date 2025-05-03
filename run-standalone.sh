#!/bin/bash

# This script runs the standalone scraper as a background process
# with automatic restart capability for production servers
# without requiring PM2

# Navigate to the project directory
cd "$(dirname "$0")"

# Create a log directory if it doesn't exist
mkdir -p logs

# Function to get current timestamp
timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Log files
LOGFILE="logs/standalone-scraper.log"
ERRORLOG="logs/standalone-scraper-error.log"

echo "[$(timestamp)] Starting standalone scraper service..." | tee -a $LOGFILE

# Start the process in the background
nohup node dist/server/standalone-scraper.js >> $LOGFILE 2>> $ERRORLOG &

# Save the process ID
PID=$!
echo $PID > scraper.pid

echo "[$(timestamp)] Standalone scraper started with PID: $PID" | tee -a $LOGFILE
echo "To monitor logs: tail -f $LOGFILE"
echo "To stop the service: kill \$(cat scraper.pid)"