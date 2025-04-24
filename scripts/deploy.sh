#!/bin/bash
# Deployment script for pawaodds.pro
# This script is meant to be executed on the server to deploy the application

set -e  # Exit on any error

echo "===================================================="
echo "Deploying pawaodds.pro"
echo "Started at: $(date)"
echo "===================================================="

# Configuration
APP_DIR="/var/www/pawaodds"
BRANCH="main"
REPO_URL="https://github.com/yourusername/pawaodds.git"  # Replace with your repo URL
BACKUP_DIR="$APP_DIR/backups/$(date +%Y%m%d_%H%M%S)"

# Check if APP_DIR exists
if [ ! -d "$APP_DIR" ]; then
  echo "Creating application directory..."
  mkdir -p "$APP_DIR"
fi

# Navigate to application directory
cd "$APP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup the current application (if it exists)
if [ -d "$APP_DIR/.git" ]; then
  echo "[1/6] Backing up current application state..."
  # Backup database (if PostgreSQL is running)
  if command -v pg_dump &> /dev/null && pg_isready &> /dev/null; then
    echo "Backing up database..."
    source .env  # Load environment variables
    DB_URL=${DATABASE_URL:-""}
    if [[ -n "$DB_URL" ]]; then
      # Extract DB name from DATABASE_URL
      DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
      if [[ -n "$DB_NAME" ]]; then
        pg_dump "$DB_NAME" > "$BACKUP_DIR/database_backup.sql"
        echo "Database backup saved to $BACKUP_DIR/database_backup.sql"
      fi
    fi
  fi
  
  # Backup .env file
  if [ -f "$APP_DIR/.env" ]; then
    echo "Backing up .env file..."
    cp "$APP_DIR/.env" "$BACKUP_DIR/.env.bak"
  fi
  
  # Backup custom files
  echo "Backing up custom files..."
  if [ -d "$APP_DIR/server/scrapers/custom" ]; then
    cp -R "$APP_DIR/server/scrapers/custom" "$BACKUP_DIR/custom_scrapers"
  fi
  
  echo "Backup completed at $BACKUP_DIR"
else
  echo "No existing application found. Proceeding with fresh install."
fi

# Clone or pull the repository
if [ -d "$APP_DIR/.git" ]; then
  echo "[2/6] Updating existing repository..."
  git fetch
  git reset --hard origin/$BRANCH
else
  echo "[2/6] Cloning repository..."
  # Get a fresh clone
  rm -rf "$APP_DIR"/*  # Clear directory
  git clone "$REPO_URL" -b "$BRANCH" .
fi

# Restore .env file from backup if it exists
if [ -f "$BACKUP_DIR/.env.bak" ]; then
  echo "Restoring .env file from backup..."
  cp "$BACKUP_DIR/.env.bak" "$APP_DIR/.env"
elif [ ! -f "$APP_DIR/.env" ]; then
  echo "No .env file found. Creating a sample one..."
  cat > "$APP_DIR/.env" << EOF
# Database configuration
DATABASE_URL=postgres://username:password@localhost:5432/dbname

# Admin key for protected routes
ADMIN_KEY=change_this_to_a_secure_key

# Node environment
NODE_ENV=production
EOF
  echo "WARNING: .env file created but contains placeholder values. Please update them!"
fi

# Restore custom scrapers if they exist
if [ -d "$BACKUP_DIR/custom_scrapers" ]; then
  echo "Restoring custom scrapers..."
  mkdir -p "$APP_DIR/server/scrapers/custom"
  cp -R "$BACKUP_DIR/custom_scrapers"/* "$APP_DIR/server/scrapers/custom"
fi

# Install dependencies
echo "[3/6] Installing dependencies..."
npm ci

# Run database migrations
echo "[4/6] Running database migrations..."
npm run db:push

# Build the application
echo "[5/6] Building the application..."
npm run build

# Restart the application
echo "[6/6] Restarting the application..."
mkdir -p logs
if command -v pm2 &> /dev/null; then
  pm2 restart pawaodds 2>/dev/null || pm2 start ecosystem.config.js
else
  echo "PM2 not found. Installing PM2..."
  npm install -g pm2
  pm2 start ecosystem.config.js
fi

# Print summary
echo "===================================================="
echo "Deployment completed at $(date)"
echo "Application is now running at http://localhost:3000"
echo ""
echo "You can check the application status with:"
echo "  pm2 status pawaodds"
echo ""
echo "You can view the logs with:"
echo "  pm2 logs pawaodds"
echo ""
echo "If you need to rollback to the previous version:"
echo "  1. Stop the current application: pm2 stop pawaodds"
echo "  2. Restore from backup: cp -R $BACKUP_DIR/* $APP_DIR/"
echo "  3. Restart: pm2 restart pawaodds"
echo "===================================================="