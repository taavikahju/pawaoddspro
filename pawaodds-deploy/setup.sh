#!/bin/bash

LOG_FILE="./deploy.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting setup..."

# Install dependencies
log "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
  log "Failed to install dependencies"
  exit 1
fi

# Check if PM2 is installed, if not install it
if ! command -v pm2 &> /dev/null; then
  log "Installing PM2..."
  npm install -g pm2
  if [ $? -ne 0 ]; then
    log "Failed to install PM2"
    exit 1
  fi
fi

# Start the application with PM2
log "Starting the application..."
pm2 delete pawaodds 2>/dev/null || true
pm2 start --name pawaodds npm -- start
if [ $? -ne 0 ]; then
  log "Failed to start application with PM2"
  exit 1
fi

pm2 save

log "Setup completed successfully!"

# Display information about how to access the application
echo ""
echo "==================================================="
echo "Your PawaOdds application is now running!"
echo "Access it at: http://localhost:3000/"
echo ""
echo "To check PM2 status: pm2 status"
echo "To view logs: pm2 logs pawaodds"
echo "==================================================="