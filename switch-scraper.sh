#!/bin/bash
# Script to switch between Node.js and Python Sportybet scrapers

NODE_SCRAPER="server/scrapers/custom/sporty_scraper.cjs"
PY_SCRAPER="server/scrapers/custom/sporty_py_scraper.py"
NODE_BACKUP="${NODE_SCRAPER}.backup"
PY_BACKUP="${PY_SCRAPER}.disabled"

function enable_python() {
  echo "Switching to Python Sportybet scraper..."
  
  # Both Python original and disabled backup exist, special case
  if [ -f "$PY_SCRAPER" ] && [ -f "$PY_BACKUP" ]; then
    echo "Python scraper is already active and backup exists."
    echo "Updating .env to use Python implementation..."
  # Python scraper exists but no backup (normal case)
  elif [ -f "$PY_SCRAPER" ]; then
    echo "Python scraper is already active."
    echo "Creating a backup copy at $PY_BACKUP"
    cp "$PY_SCRAPER" "$PY_BACKUP"
  # Only backup exists, need to restore
  elif [ -f "$PY_BACKUP" ]; then
    echo "Activating Python scraper from backup..."
    cp "$PY_BACKUP" "$PY_SCRAPER"
  # Neither exists, can't proceed
  else
    echo "Error: Neither Python scraper nor backup found"
    echo "Expected locations:"
    echo "  - $PY_SCRAPER"
    echo "  - $PY_BACKUP"
    exit 1
  fi
  
  # Backup the Node.js scraper if not already backed up
  if [ -f "$NODE_SCRAPER" ] && [ ! -f "$NODE_BACKUP" ]; then
    echo "Backing up Node.js scraper to $NODE_BACKUP"
    cp "$NODE_SCRAPER" "$NODE_BACKUP"
  fi
  
  # Create a .env file to enable Python scraper in the scheduler
  echo "USE_PYTHON_SPORTYBET=true" > .env
  echo "PYTHON_SCRAPER_ACTIVE=true" >> .env
  
  echo "✅ Successfully switched to Python Sportybet scraper"
  echo "The next scheduled run will use the Python implementation"
}

function enable_nodejs() {
  echo "Switching to Node.js Sportybet scraper..."
  
  # Node.js scraper already exists
  if [ -f "$NODE_SCRAPER" ]; then
    echo "Node.js scraper is already active."
    
    # Make a backup if it doesn't exist
    if [ ! -f "$NODE_BACKUP" ]; then
      echo "Creating a backup copy at $NODE_BACKUP"
      cp "$NODE_SCRAPER" "$NODE_BACKUP"
    fi
  # Node.js backup exists but active file doesn't
  elif [ -f "$NODE_BACKUP" ]; then
    echo "Restoring Node.js scraper from backup..."
    cp "$NODE_BACKUP" "$NODE_SCRAPER"
  # Neither exists, can't proceed
  else 
    echo "Error: Neither Node.js scraper nor backup found"
    echo "Expected locations:"
    echo "  - $NODE_SCRAPER"
    echo "  - $NODE_BACKUP"
    exit 1
  fi
  
  # Update .env to use Node.js scraper
  echo "USE_PYTHON_SPORTYBET=false" > .env
  echo "PYTHON_SCRAPER_ACTIVE=false" >> .env
  
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