#!/bin/bash

LOG_FILE="/root/pawaodds-deploy.log"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting deployment..."

# Create deployment directory if it doesn't exist
DEPLOY_DIR="/root/pawaodds"
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Check if the zip file exists and copy files
if [ -f "/root/BookmakerScraper.zip" ]; then
  log "Found BookmakerScraper.zip, extracting..."
  
  # Create a temporary directory for extraction
  TEMP_DIR="/root/temp_extract"
  mkdir -p $TEMP_DIR
  
  # Extract files to temporary directory
  unzip -o /root/BookmakerScraper.zip -d $TEMP_DIR
  
  # Copy important files
  cp -r $TEMP_DIR/BookmakerScraper/server $DEPLOY_DIR/
  cp -r $TEMP_DIR/BookmakerScraper/client $DEPLOY_DIR/
  cp -r $TEMP_DIR/BookmakerScraper/shared $DEPLOY_DIR/
  cp $TEMP_DIR/BookmakerScraper/package.json $DEPLOY_DIR/
  
  # Clean up temporary directory
  rm -rf $TEMP_DIR
  
  log "Files extracted and copied successfully"
else
  log "BookmakerScraper.zip not found, checking for individual files..."
  
  # If the zip doesn't exist, copy from GitHub directory if available
  if [ -d "/var/www/pawaodds/github" ]; then
    log "Copying files from GitHub directory..."
    cp -r /var/www/pawaodds/github/* $DEPLOY_DIR/
    log "Files copied from GitHub directory"
  else
    # If neither source exists, download from GitHub and extract
    GITHUB_USER="taavikahju"
    REPO="BookmakerScraper"
    
    log "Downloading from GitHub ($GITHUB_USER/$REPO)..."
    wget -O /tmp/$REPO.zip https://github.com/$GITHUB_USER/$REPO/archive/refs/heads/main.zip
    
    if [ $? -eq 0 ]; then
      log "Download successful, extracting..."
      unzip -o /tmp/$REPO.zip -d /tmp
      cp -r /tmp/$REPO-main/* $DEPLOY_DIR/
      rm -rf /tmp/$REPO-main /tmp/$REPO.zip
      log "Files extracted and copied from GitHub"
    else
      log "Failed to download from GitHub"
      # If all else fails, use our basic setup
      log "Using basic Express setup..."
      cp -r /home/runner/workspace/pawaodds-deploy/* $DEPLOY_DIR/
    fi
  fi
fi

# Create .env file if it doesn't exist
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  log "Creating .env file..."
  cat > $DEPLOY_DIR/.env << 'EOF'
PORT=3000
DATABASE_URL=postgresql://pawauser:P66ri66%401987@localhost:5432/pawaodds
ADMIN_KEY=xcINLB7qo0kx3Rxpe9PMHXE3yL4pGwyh
NODE_ENV=production
EOF
fi

# Install dependencies
cd $DEPLOY_DIR
log "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
  log "Failed to install dependencies, trying with legacy peer deps..."
  npm install --legacy-peer-deps
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  log "Installing PM2..."
  npm install -g pm2
fi

# Setup database if schema.ts exists
if [ -f "$DEPLOY_DIR/shared/schema.ts" ]; then
  log "Setting up database..."
  # Create database if it doesn't exist
  sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw pawaodds
  if [ $? -ne 0 ]; then
    log "Creating database and user..."
    sudo -u postgres psql -c "CREATE DATABASE pawaodds;" || echo "Database already exists"
    sudo -u postgres psql -c "CREATE USER pawauser WITH ENCRYPTED PASSWORD 'P66ri66@1987';" || echo "User already exists"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE pawaodds TO pawauser;"
    sudo -u postgres psql -c "ALTER USER pawauser WITH SUPERUSER;"
  fi
  
  # Push database changes if drizzle-kit is available
  if [ -f "$DEPLOY_DIR/drizzle.config.ts" ]; then
    npx drizzle-kit push:pg || npm run db:push
  fi
fi

# Setup Nginx if it's installed
if command -v nginx &> /dev/null; then
  log "Setting up Nginx..."
  # Copy Nginx configuration
  cp $DEPLOY_DIR/nginx.conf /etc/nginx/sites-available/pawaodds
  ln -sf /etc/nginx/sites-available/pawaodds /etc/nginx/sites-enabled/
  
  # Test and restart Nginx
  nginx -t
  if [ $? -eq 0 ]; then
    systemctl restart nginx
  else
    log "Nginx configuration test failed, not restarting"
  fi
  
  # Setup SSL with certbot if available
  if command -v certbot &> /dev/null; then
    log "Setting up SSL with certbot..."
    certbot --nginx -d pawaodds.pro -d www.pawaodds.pro --non-interactive --agree-tos -m admin@pawaodds.pro || log "Certbot failed, but continuing deployment"
  fi
fi

# Start the application with PM2
log "Starting the application..."
pm2 delete pawaodds 2>/dev/null || true
pm2 start --name pawaodds npm -- start
pm2 save

log "Deployment completed successfully!"
echo ""
echo "==================================================="
echo "Your PawaOdds application is now running!"
echo "Access it at: http://pawaodds.pro/"
echo ""
echo "To check PM2 status: pm2 status"
echo "To view logs: pm2 logs pawaodds"
echo "==================================================="