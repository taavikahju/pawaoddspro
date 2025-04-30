#!/bin/bash
echo "===== DEPLOYING WITHOUT LIVE SCRAPER ====="
echo "This script removes the live scraper feature and ESM dependencies for deployment"

# Step 1: Create CommonJS config files if they don't exist
echo "Step 1: Creating CommonJS config files..."
if [ ! -f postcss.config.cjs ]; then
  cat > postcss.config.cjs << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
EOF
  echo "✅ Created PostCSS config"
fi

if [ ! -f tailwind.config.cjs ]; then
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
fi

# Step 2: Ensure directories exist
echo "Step 2: Creating necessary directories..."
mkdir -p server/scrapers/custom
mkdir -p dist/public

# Step 3: Backup original package.json
echo "Step 3: Backing up package.json..."
cp package.json package.json.bak

# Step 4: Create deployment package.json
echo "Step 4: Creating deployment package.json..."
cat > package.json.deploy << 'EOF'
{
  "name": "pawaodds-scraper",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node server/index.cjs",
    "build": "vite build --config vite.config.cjs && mkdir -p dist/public",
    "dev": "node server/index.cjs"
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
    "multer": "1.4.5-lts.2",
    "nanoid": "3.3.4",
    "next-themes": "0.4.6",
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
    "tsx": "4.19.4",
    "vite": "5.0.2",
    "wouter": "2.12.0",
    "ws": "8.14.2",
    "zod": "3.22.4"
  }
}
EOF
echo "✅ Created deployment package.json"

# Step 5: Create deployment instructions
cat > DEPLOYMENT_WITHOUT_LIVE_SCRAPER.md << 'EOF'
# Deployment Without Live Scraper

To deploy your application on Replit without the live scraper feature:

## Deployment Steps

1. Replace your package.json with the deployment version:
   ```bash
   cp package.json.deploy package.json
   ```

2. Build the client:
   ```bash
   npm run build
   ```

3. Start the application:
   ```bash
   npm start
   ```

## What This Removes

This deployment approach temporarily disables:

1. The live scraper feature (bp_gh_live_scraper.mjs)
2. Live heartbeat tracking
3. ES Module specific code that causes deployment issues

## How to Restore Original Functionality

After successfully deploying your application, you can restore your development environment:

```bash
cp package.json.bak package.json
```

## Technical Details

The main changes in this deployment:

1. Converted ES Module files to CommonJS (.cjs extension)
2. Removed top-level await and import.meta references
3. Created simplified implementations of key services
4. Used explicit __dirname instead of import.meta.dirname

These changes make your application compatible with Replit's deployment environment while preserving the core functionality.
EOF

echo ""
echo "✅ Deployment setup complete!"
echo "To deploy, run: cp package.json.deploy package.json && npm run build && npm start"
echo "See DEPLOYMENT_WITHOUT_LIVE_SCRAPER.md for more details."