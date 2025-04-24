#!/bin/bash
# Quick deployment script for pawaodds.pro
# This script can be run locally to quickly deploy to your server

set -e  # Exit on any error

# Configuration - EDIT THESE
SERVER_IP="your-server-ip-here"
SERVER_USER="deploy"
SERVER_APP_DIR="/var/www/pawaodds"
PM2_APP_NAME="pawaodds"

# Print header
echo "===================================================="
echo "Fast deployment script for pawaodds.pro"
echo "Target server: $SERVER_USER@$SERVER_IP:$SERVER_APP_DIR"
echo "Started at: $(date)"
echo "===================================================="

# Step 1: Push local changes to GitHub
echo "[1/4] Pushing local changes to GitHub..."
git add .
git commit -m "Quick deploy update at $(date)" || true  # Continue if no changes to commit
git push

# Step 2: SSH into server and pull changes
echo "[2/4] Pulling latest changes from GitHub to server..."
ssh $SERVER_USER@$SERVER_IP "cd $SERVER_APP_DIR && git pull"

# Step 3: Update dependencies, build, and run migrations
echo "[3/4] Building application and updating database..."
ssh $SERVER_USER@$SERVER_IP "cd $SERVER_APP_DIR && npm install && npm run build && npm run db:push"

# Step 4: Restart the application
echo "[4/4] Restarting application..."
ssh $SERVER_USER@$SERVER_IP "cd $SERVER_APP_DIR && pm2 restart $PM2_APP_NAME"

# Print summary
echo "===================================================="
echo "Deployment completed at $(date)"
echo "The application should now be updated at https://your-domain.com"
echo "===================================================="

# Optional: Open the website in a browser
# uncomment this line to automatically open the website after deployment
# open "https://your-domain.com"