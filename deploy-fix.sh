#!/bin/bash

echo "===== Repairing Deployment Structure ====="

# Step 1: Check if we have the built files
if [ ! -f dist/index.js ]; then
  echo "ERROR: Build files not found. Please run 'npm run build' first."
  exit 1
fi

# Step 2: Fix the directory structure
mkdir -p dist/server/scrapers/custom

# Step 3: Copy the main server file to the expected location
cp dist/index.js dist/server/index.js

# Step 4: Copy the ES module scraper file to the correct location
cp server/scrapers/custom/bp_gh_live_scraper.mjs dist/server/scrapers/custom/

# Step 5: Copy all other necessary custom scraper files
find server/scrapers/custom -name "*.cjs" -o -name "*.js" -o -name "*.mjs" -o -name "*.d.ts" | xargs -I{} cp {} dist/server/scrapers/custom/

# Step 6: Create the data directory
mkdir -p dist/data

# Step 7: Create a proper package.json in the dist directory with ES module support
cat > dist/package.json << 'EOF'
{
  "type": "module",
  "scripts": {
    "start": "NODE_ENV=production node server/index.js"
  }
}
EOF

# Step 8: Create a server-info file for Replit deployment
cat > dist/server-info.json << 'EOF'
{
  "entrypoint": "server/index.js",
  "nodejs_version": "20"
}
EOF

# Step 9: Copy any .env file if it exists
if [ -f .env ]; then
  cp .env dist/.env
fi

# Step 10: Create an explicit start script that Replit will run
cat > dist/start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
NODE_ENV=production node server/index.js
EOF
chmod +x dist/start.sh

echo "===== Deployment repair completed! ====="
echo "To deploy: Upload the entire 'dist' directory to your server."
echo "The application will start with 'node server/index.js' in the dist directory."