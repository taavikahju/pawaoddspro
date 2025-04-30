#!/bin/bash
echo "Building for production..."

# Build the client
echo "Building client..."
npx vite build --config vite.config.cjs

# Build the server
echo "Building server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist

echo "Build complete!"
