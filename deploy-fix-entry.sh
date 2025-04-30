#!/bin/bash
echo "===== DEPLOYMENT ENTRY FIX SCRIPT ====="
echo "This script fixes the entry module issue in Vite build"

# Step 1: Clean up any previous deployment files
echo "Step 1: Cleaning up previous files..."
rm -rf dist
rm -f postcss.config.* tailwind.config.* vite.config.cjs vite.config.js package.json.deploy package.json.bak

# Step 2: Create CommonJS config files
echo "Step 2: Creating CommonJS config files..."
cat > postcss.config.cjs << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
EOF
echo "✅ Created PostCSS config"

cat > tailwind.config.cjs << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
EOF
echo "✅ Created Tailwind config"

# Step 3: Create a Vite config that explicitly specifies the root and entry
cat > vite.config.cjs << 'EOF'
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

module.exports = defineConfig({
  root: "./client",  // Explicitly set the root directory
  plugins: [react()],
  build: {
    outDir: "../dist/client",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
EOF
echo "✅ Created Vite config with explicit root"

# Step 4: Create a minimal package.json for deployment
cp package.json package.json.bak
cat > package.json.deploy << 'EOF'
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node dist/index.js",
    "build": "vite build --config vite.config.cjs && esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist"
  },
  "dependencies": {
    "@hookform/resolvers": "3.3.2",
    "@neondatabase/serverless": "0.6.0",
    "@tailwindcss/typography": "0.5.10",
    "@tanstack/react-query": "5.8.4",
    "@vitejs/plugin-react": "4.2.0",
    "autoprefixer": "10.4.15",
    "axios": "1.6.2",
    "clsx": "2.0.0",
    "connect-pg-simple": "9.0.0",
    "drizzle-orm": "0.28.6",
    "drizzle-zod": "0.5.1",
    "esbuild": "0.19.8",
    "express": "4.18.2",
    "express-session": "1.17.3",
    "lucide-react": "0.292.0",
    "memorystore": "1.6.7",
    "node-cron": "3.0.3",
    "passport": "0.6.0",
    "passport-local": "1.0.0",
    "postcss": "8.4.31",
    "react": "18.3.1",  
    "react-country-flag": "3.1.0",
    "react-dom": "18.3.1",
    "react-hook-form": "7.48.2",
    "react-icons": "4.12.0",
    "tailwindcss": "3.3.5",
    "tailwindcss-animate": "1.0.7",
    "vite": "5.0.2",
    "wouter": "2.12.0",
    "ws": "8.14.2",
    "zod": "3.22.4"
  }
}
EOF
echo "✅ Created deployment package.json with matching React versions"

# Step 5: Set up SPA routing
echo "Step 5: Setting up SPA routing..."
mkdir -p public/tournament-margins public/live-heartbeat public/admin
# Copy index.html to these directories
if [ -f client/index.html ]; then
  cp client/index.html public/tournament-margins/index.html
  cp client/index.html public/live-heartbeat/index.html
  cp client/index.html public/admin/index.html
  echo "✅ Set up SPA routing"
else
  echo "⚠️ Warning: client/index.html not found, SPA routing setup incomplete"
fi

# Step 6: Create deployment instructions
cat > ENTRY_FIX_DEPLOYMENT.md << 'EOF'
# Entry Fix Deployment Instructions

## Deployment Steps

1. Replace your package.json with the deployment version:
   ```bash
   cp package.json.deploy package.json
   ```

2. Click the Deploy button in Replit.

3. After deployment completes, restore your development package.json:
   ```bash
   cp package.json.bak package.json
   ```

## What This Script Fixes

The main issue in previous deployment attempts was related to Vite not being able to find the entry module (index.html). This script:

1. Explicitly sets the root directory for Vite to "./client"
2. Matches React and ReactDOM versions to avoid peer dependency conflicts
3. Uses CommonJS format for configuration files
4. Uses a simplified build command that works with the explicit root

## Troubleshooting

If you encounter further issues:

1. Check the Vite documentation for the latest CommonJS configuration approach
2. Make sure all dependency versions are compatible
3. Verify that client/index.html exists and is properly formatted
EOF

echo ""
echo "✅ Entry fix deployment setup complete!"
echo "Follow the instructions in ENTRY_FIX_DEPLOYMENT.md to deploy your application."