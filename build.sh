#!/bin/bash

# Message
echo "===== Building the application ====="

# Make sure we're in the project root
cd "$(dirname "$0")"

echo "Step 1: Building client with Vite..."
NODE_ENV=production npx vite build

echo "Step 2: Creating server directory structure..."
mkdir -p dist/server/scrapers/custom
mkdir -p dist/server/middleware

echo "Step 3: Building server with esbuild..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/server/index.js

echo "Step 4: Copying necessary files..."
# Copy the MJS file
cp server/scrapers/custom/bp_gh_live_scraper.mjs dist/server/scrapers/custom/

# Copy other necessary custom scraper files that might be needed
mkdir -p dist/server/scrapers/custom
find server/scrapers/custom -name "*.cjs" -o -name "*.js" -o -name "*.mjs" | xargs -I{} cp {} dist/server/scrapers/custom/

# Copy any other necessary non-TypeScript files
cp -r server/middleware dist/server/
cp -r shared dist/

echo "Step 5: Creating data directory for scrapers..."
mkdir -p dist/data

echo "Step 6: Creating startup script..."
cat > dist/start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
NODE_ENV=production node server/index.js
EOF
chmod +x dist/start.sh

# Create a .env file in the dist directory if it doesn't exist
if [ ! -f dist/.env ]; then
  echo "Step 7: Creating .env file..."
  touch dist/.env
  # Copy from existing .env if it exists
  if [ -f .env ]; then
    cp .env dist/.env
  fi
fi

echo "Step 8: Creating deployment structure file..."
# Create a special file that Replit looks for during deployment
cat > dist/server-info.json << 'EOF'
{
  "entrypoint": "server/index.js",
  "nodejs_version": "20"
}
EOF

echo "===== Build completed successfully! ====="
echo "To start the application in production mode, run: ./dist/start.sh"