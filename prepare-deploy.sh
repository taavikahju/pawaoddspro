#!/bin/bash

echo "Building application for Replit deployment..."

# Build the application
npm run build

# Test the ESM build locally
echo "Testing ESM build..."
NODE_ENV=production node --trace-warnings --input-type=module dist/index.js --test-only 2>&1 | grep -i "esm\|module"

echo ""
echo "==== Deployment Preparation Complete ===="
echo "If no ESM errors appeared above, your application is ready for Replit Deploy!"
echo "Click the 'Deploy' button in Replit to publish your application."