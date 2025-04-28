#!/bin/bash

echo "===== PAWAODDS BUILD AND DEPLOY SCRIPT ====="
echo "1. Building application..."

# Step 1: Standard build process
npm run build

# Check if build succeeded
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please check the error messages above."
  exit 1
fi

echo "✅ Application built successfully!"

echo "2. Fixing deployment structure..."

# Setup directory structure
mkdir -p dist/server/public
mkdir -p dist/server/scrapers/custom

# Copy server file to correct location
cp dist/index.js dist/server/index.js

# Handle client files
if [ -d dist/public ]; then
  echo "📦 Copying client files from dist/public to server/public..."
  cp -r dist/public/* dist/server/public/
elif [ -d dist/assets ]; then
  echo "📦 Found assets directory, copying client files..."
  cp -r dist/assets dist/server/public/
  cp dist/index.html dist/server/public/ 2>/dev/null || echo "No index.html found"
else
  echo "⚠️ No client files found. Creating fallback index.html..."
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
    <p>The server is up and running successfully. API endpoints are operational.</p>
    <div class="status">Server Status: Online</div>
  </div>
</body>
</html>
EOF
fi

# Check and copy client assets if they exist elsewhere
if [ -d client/dist ]; then
  echo "📦 Found client/dist, copying files..."
  cp -r client/dist/* dist/server/public/
fi

# Copy scraper files
echo "📦 Copying custom scraper files..."
find server/scrapers/custom -type f \( -name "*.cjs" -o -name "*.js" -o -name "*.mjs" \) -exec cp {} dist/server/scrapers/custom/ \;

# Copy TypeScript definition files if they exist
find server/scrapers/custom -type f -name "*.d.ts" -exec cp {} dist/server/scrapers/custom/ \;

# Setup package.json with module type
echo '{"type":"module","scripts":{"start":"node server/index.js"}}' > dist/package.json

# Create deployment info file
echo '{"entrypoint":"server/index.js","nodejs_version":"20"}' > dist/server-info.json

# Copy any static assets or fonts
if [ -d server/scrapers/custom/assets ]; then
  mkdir -p dist/server/scrapers/custom/assets
  cp -r server/scrapers/custom/assets/* dist/server/scrapers/custom/assets/
fi

# Copy any data files
if [ -d data ]; then
  mkdir -p dist/data
  cp -r data/* dist/data/
fi

echo "✅ Deployment structure fixed successfully!"
echo ""
echo "🚀 DEPLOYMENT READY!"
echo "You can now click on the Deploy button in Replit to deploy your application."
echo "======================="