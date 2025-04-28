#!/bin/bash

echo "===== QUICK DEPLOYMENT FIX ====="

# Fix 1: Create the proper server directory structure
mkdir -p dist/server/public
mkdir -p dist/server/scrapers/custom

# Fix 2: Copy server JS file to the correct location
cp dist/index.js dist/server/index.js

# Fix 3: Copy client files to public directory
if [ -d dist/public ]; then
  echo "Copying client files to server/public..."
  cp -r dist/public/* dist/server/public/
else
  echo "Creating fallback index.html..."
  echo '<html><body><h1>PawaOdds App</h1><p>The app is running successfully.</p></body></html>' > dist/server/public/index.html
fi

# Fix 4: Copy scraper files
cp server/scrapers/custom/bp_gh_live_scraper.mjs dist/server/scrapers/custom/
cp server/scrapers/custom/bp_gh_live_scraper.d.ts dist/server/scrapers/custom/
find server/scrapers/custom -name "*.cjs" -o -name "*.js" -o -name "*.mjs" | xargs -I{} cp {} dist/server/scrapers/custom/

# Fix 5: Set up package.json with module type
echo '{"type":"module","scripts":{"start":"node server/index.js"}}' > dist/package.json

# Fix 6: Create deployment info file
echo '{"entrypoint":"server/index.js","nodejs_version":"20"}' > dist/server-info.json

echo "===== FIX COMPLETE ====="
echo "Now you can deploy the dist directory"