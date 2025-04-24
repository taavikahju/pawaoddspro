#!/bin/bash
# Deployment script for pawaodds.pro
# Run this on your Hetzner Cloud server to pull updates from GitHub

set -e  # Exit on any error

# Configuration
APP_DIR="/var/www/pawaodds"
GITHUB_REPO="https://github.com/yourusername/pawaodds.git"
NODE_ENV="production"
PM2_APP_NAME="pawaodds"

# Print status
echo "Starting deployment at $(date)"
echo "=========================================="

# Navigate to app directory
cd $APP_DIR
echo "Current directory: $(pwd)"

# Pull latest changes from GitHub
echo "Pulling latest changes from GitHub..."
git pull origin main

# Install dependencies if needed
echo "Installing dependencies..."
npm install

# Build the client
echo "Building client..."
npm run build

# Run database migrations if needed
echo "Pushing database schema changes..."
npm run db:push

# Restart the application
echo "Restarting application with PM2..."
pm2 restart $PM2_APP_NAME

# Check the application status
echo "Application status:"
pm2 status $PM2_APP_NAME

echo "=========================================="
echo "Deployment completed at $(date)"