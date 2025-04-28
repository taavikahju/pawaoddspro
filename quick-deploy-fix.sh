#!/bin/bash

echo "===== QUICK DEPLOYMENT FIX ====="

# Fix 1: Create the proper server directory structure
mkdir -p dist/server/public
mkdir -p dist/server/scrapers/custom

# Fix 2: Copy server JS file to the correct location
cp dist/index.js dist/server/index.js

# Fix 3: Copy client files to public directory
if [ -d dist/public ]; then
  echo "Copying client files from dist/public to server/public..."
  cp -r dist/public/* dist/server/public/
elif [ -d dist/assets ]; then
  echo "Found assets directory, copying client files..."
  cp -r dist/assets dist/server/public/
  cp dist/index.html dist/server/public/ 2>/dev/null || echo "No index.html found"
else
  echo "Creating fallback index.html..."
  cat > dist/server/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PawaOdds App</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background: linear-gradient(135deg, #1e293b, #0f172a);
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      background: rgba(30, 41, 59, 0.7);
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 20px;
      background: linear-gradient(to right, #38bdf8, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      font-size: 1.2rem;
      line-height: 1.6;
      color: #e2e8f0;
      margin-bottom: 20px;
    }
    .status {
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 50px;
      font-weight: bold;
      display: inline-block;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>PawaOdds App</h1>
    <p>The server is up and running successfully. The backend API is operational, but the client-side application may not be fully deployed.</p>
    <p>If you're seeing this page instead of the application, it means there might be an issue with the client build. Try checking the deployment logs.</p>
    <div class="status">Server Status: Online</div>
  </div>
</body>
</html>
EOF
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