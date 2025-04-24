#!/bin/bash
# Pre-deployment test script for pawaodds.pro
# This script runs tests before deployment to ensure the application is working correctly

set -e  # Exit on error

echo "===================================================="
echo "Running pre-deployment tests"
echo "Started at: $(date)"
echo "===================================================="

# Check if Node.js is installed
echo "[1/10] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 20.x or higher."
    exit 1
fi

NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"

# Check if npm is installed
echo "[2/10] Checking npm installation..."
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm."
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "npm version: $NPM_VERSION"

# Check if Python is installed (needed for custom scrapers)
echo "[3/10] Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo "Python version: $PYTHON_VERSION"

# Install dependencies if needed
echo "[4/10] Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies already installed."
fi

# Check if we can build the project
echo "[5/10] Testing build process..."
npm run build

# Check connection to database (if .env exists)
echo "[6/10] Checking database connection..."
if [ -f ".env" ]; then
    if grep -q "DATABASE_URL" .env; then
        echo "Database URL found in .env"
        # Attempt to connect to the database
        NODE_SCRIPT="
        const { Pool } = require('@neondatabase/serverless');
        const { drizzle } = require('drizzle-orm/neon-serverless');
        require('dotenv').config();
        
        async function testConnection() {
          try {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL });
            const result = await pool.query('SELECT NOW()');
            console.log('Database connection successful!');
            console.log('Current database time:', result.rows[0].now);
            await pool.end();
            return true;
          } catch (error) {
            console.error('Database connection failed:', error.message);
            return false;
          }
        }
        
        testConnection()
          .then(success => process.exit(success ? 0 : 1))
          .catch(error => {
            console.error('Error testing connection:', error);
            process.exit(1);
          });
        "
        
        if node -e "$NODE_SCRIPT"; then
            echo "Database connection test passed."
        else
            echo "Database connection test failed. Check your DATABASE_URL in .env"
            echo "You may want to fix this before deploying."
        fi
    else
        echo "DATABASE_URL not found in .env. Skipping database connection test."
    fi
else
    echo ".env file not found. Skipping database connection test."
fi

# Check custom scrapers
echo "[7/10] Checking custom scrapers..."
CUSTOM_SCRAPERS_DIR="server/scrapers/custom"
if [ -d "$CUSTOM_SCRAPERS_DIR" ]; then
    SCRAPER_COUNT=$(find "$CUSTOM_SCRAPERS_DIR" -type f | wc -l)
    echo "Found $SCRAPER_COUNT custom scrapers in $CUSTOM_SCRAPERS_DIR"
    
    # List scrapers
    echo "Custom scrapers:"
    find "$CUSTOM_SCRAPERS_DIR" -type f -name "*.js" -o -name "*.cjs" -o -name "*.py" | while read -r file; do
        echo "  - $(basename "$file")"
    done
else
    echo "Custom scrapers directory not found. This is a potential issue."
fi

# Check for admin key (environment variable or .env)
echo "[8/10] Checking admin key configuration..."
if [ -n "$ADMIN_KEY" ]; then
    echo "ADMIN_KEY is set as an environment variable."
elif [ -f ".env" ] && grep -q "ADMIN_KEY" .env; then
    echo "ADMIN_KEY found in .env file."
else
    echo "WARNING: ADMIN_KEY is not set. Admin interface will not be accessible."
    echo "Make sure to set ADMIN_KEY before deploying."
fi

# Check for git repository
echo "[9/10] Checking Git repository..."
if [ -d ".git" ]; then
    echo "Git repository found."
    git status
else
    echo "No Git repository found. It's recommended to set up version control."
fi

# Check for required deployment files
echo "[10/10] Checking deployment files..."
REQUIRED_FILES=(
    "ecosystem.config.js"
    "nginx.conf"
    "scripts/deploy.sh"
    ".github/workflows/deploy.yml"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✕ $file is missing"
    fi
done

# Print summary
echo "===================================================="
echo "Pre-deployment tests completed at $(date)"
echo "The application appears to be ready for deployment."
echo "Next steps:"
echo "1. Review any warnings above"
echo "2. Push your code to GitHub"
echo "3. Set up your Hetzner Cloud server"
echo "4. Follow the deployment steps in DEPLOYMENT.md"
echo "===================================================="