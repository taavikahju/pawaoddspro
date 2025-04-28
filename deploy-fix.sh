#!/bin/bash

echo "===== Quick Fix for Deployment Issues ====="

# Create necessary directory structure
mkdir -p dist/server/scrapers/custom

# Copy the ES module scraper file to the correct location
cp server/scrapers/custom/bp_gh_live_scraper.mjs dist/server/scrapers/custom/

# Create a package.json in the dist directory
cat > dist/package.json << 'EOF'
{
  "type": "module",
  "scripts": {
    "start": "node server/index.js"
  }
}
EOF

# Create a server-info file for Replit
cat > dist/server-info.json << 'EOF'
{
  "entrypoint": "server/index.js",
  "nodejs_version": "20"
}
EOF

echo "===== Quick deployment fix completed ====="
echo "After building with 'npm run build', run this script for proper deployment structure."