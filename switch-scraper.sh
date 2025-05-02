#!/bin/bash
# Script to switch between Node.js and Python Sportybet scrapers

NODE_SCRAPER="server/scrapers/custom/sporty_scraper.cjs"
PY_SCRAPER="server/scrapers/custom/sporty_py_scraper.py"
NODE_BACKUP="${NODE_SCRAPER}.backup"
PY_BACKUP="${PY_SCRAPER}.disabled"

function enable_python() {
  echo "Switching to Python Sportybet scraper..."
  
  # First check if files exist
  if [ ! -f "$PY_BACKUP" ]; then
    echo "Error: Python scraper backup file not found at $PY_BACKUP"
    exit 1
  fi
  
  # Backup the Node.js scraper if not already backed up
  if [ -f "$NODE_SCRAPER" ] && [ ! -f "$NODE_BACKUP" ]; then
    echo "Backing up Node.js scraper to $NODE_BACKUP"
    cp "$NODE_SCRAPER" "$NODE_BACKUP"
  fi
  
  # Rename to make Python the active scraper
  echo "Activating Python scraper..."
  cp "$PY_BACKUP" "$PY_SCRAPER"
  
  # Create a .env file to enable Python scraper in the scheduler
  echo "USE_PYTHON_SPORTYBET=true" > .env
  
  echo "✅ Successfully switched to Python Sportybet scraper"
  echo "The next scheduled run will use the Python implementation"
}

function enable_nodejs() {
  echo "Switching to Node.js Sportybet scraper..."
  
  # First check if backup exists
  if [ ! -f "$NODE_BACKUP" ]; then
    echo "Error: Node.js scraper backup file not found at $NODE_BACKUP"
    exit 1
  fi
  
  # Restore the Node.js scraper
  echo "Restoring Node.js scraper..."
  cp "$NODE_BACKUP" "$NODE_SCRAPER"
  
  # Remove Python scraper if it exists (keeping the backup)
  if [ -f "$PY_SCRAPER" ]; then
    echo "Removing active Python scraper..."
    rm "$PY_SCRAPER"
  fi
  
  # Update .env to use Node.js scraper
  echo "USE_PYTHON_SPORTYBET=false" > .env
  
  echo "✅ Successfully switched to Node.js Sportybet scraper"
  echo "The next scheduled run will use the Node.js implementation"
}

# Main script logic
if [ "$1" == "python" ]; then
  enable_python
elif [ "$1" == "nodejs" ]; then
  enable_nodejs
else
  echo "Usage: $0 [python|nodejs]"
  echo ""
  echo "This script switches between Node.js and Python implementations of the Sportybet scraper"
  echo "  python - Enable the Python implementation"
  echo "  nodejs - Enable the Node.js implementation (default)"
  echo ""
  echo "Current scraper status:"
  
  if [ -f "$PY_SCRAPER" ]; then
    echo "✅ Python scraper is ACTIVE"
  else
    echo "❌ Python scraper is INACTIVE"
  fi
  
  if [ -f "$NODE_SCRAPER" ]; then
    echo "✅ Node.js scraper is ACTIVE"
  else
    echo "❌ Node.js scraper is INACTIVE"
  fi
  
  # Check the .env file
  if [ -f ".env" ] && grep -q "USE_PYTHON_SPORTYBET=true" .env; then
    echo "🔄 Environment is set to use Python scraper"
  else
    echo "🔄 Environment is set to use Node.js scraper"
  fi
fi