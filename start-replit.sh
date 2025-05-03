#!/bin/bash

# This script starts both the main application and the standalone scraper
# for Replit deployment

# Set environment variables
export NODE_ENV=production

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to get current timestamp
timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

echo "[$(timestamp)] Starting PawaOdds application and scrapers..."

# Start the main application
node dist/server/index.js > logs/main-app.log 2>&1 &
MAIN_PID=$!
echo "[$(timestamp)] Main application started with PID: $MAIN_PID"

# Give the main app a moment to start
sleep 5

# Start the standalone scraper
node dist/server/standalone-scraper.js > logs/standalone-scraper.log 2>&1 &
SCRAPER_PID=$!
echo "[$(timestamp)] Standalone scraper started with PID: $SCRAPER_PID"

echo "[$(timestamp)] Both services started. Press Ctrl+C to stop both."

# Save PIDs to files
echo $MAIN_PID > main-app.pid
echo $SCRAPER_PID > scraper.pid

# Wait for either process to exit
wait $MAIN_PID
echo "[$(timestamp)] Main application stopped. Stopping scraper..."
kill $SCRAPER_PID