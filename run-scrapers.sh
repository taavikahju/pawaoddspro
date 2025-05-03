#!/bin/bash

# Script to run the standalone scraper process
# This should be executed by systemd, PM2, or another process manager

# Set environment variables
export NODE_ENV=production

# Navigate to the project directory
cd "$(dirname "$0")"

# Start the scraper with auto-restart
while true; do
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting standalone scraper process..."
  
  # Use node to run the compiled TypeScript file
  node dist/server/standalone-scraper.js
  
  # If the process exits, wait 30 seconds before restarting
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Scraper process exited, restarting in 30 seconds..."
  sleep 30
done