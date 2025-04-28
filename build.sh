#!/bin/bash

# Message
echo "Building the application..."

# Run the vite build for the client
npm run build

# Create necessary directories
mkdir -p dist/server/scrapers/custom

# Build server with esbuild
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist/server

# Copy the MJS file to the output directory
cp server/scrapers/custom/bp_gh_live_scraper.mjs dist/server/scrapers/custom/

# Create a startup script
echo "#!/bin/bash
NODE_ENV=production node dist/server/index.js" > dist/start.sh
chmod +x dist/start.sh

echo "Build completed successfully!"