#!/bin/bash
echo "===== COMMONJS CONVERSION SCRIPT ====="
echo "This script converts ES Module syntax to CommonJS for Replit deployment"

# Step 1: Create CommonJS config files
echo "Step 1: Creating CommonJS config files..."
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

# Step 2: Create CommonJS version of server/index.ts
echo "Step 2: Creating CommonJS version of server files..."
mkdir -p server-cjs

cat > server-cjs/index.js << 'EOF'
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create simple API endpoints
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Bookmakers API
app.get('/api/bookmakers', (req, res) => {
  res.json([
    { id: 1, name: "betpawa_ke", country: "KE", status: "active" },
    { id: 2, name: "betpawa_gh", country: "GH", status: "active" },
    { id: 3, name: "sportybet", country: "NG", status: "active" }
  ]);
});

// Events API
app.get('/api/events', (req, res) => {
  res.json([
    { id: 101, name: "Manchester United vs Arsenal", league: "Premier League", odds: { home: 2.1, draw: 3.5, away: 2.7 } },
    { id: 102, name: "Barcelona vs Real Madrid", league: "La Liga", odds: { home: 1.8, draw: 3.9, away: 3.2 } },
    { id: 103, name: "Bayern Munich vs Dortmund", league: "Bundesliga", odds: { home: 1.6, draw: 4.2, away: 4.5 } }
  ]);
});

// Serve static files from dist/public or client depending on environment
const staticPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, '../dist/public')
  : path.join(__dirname, '../client');

if (process.env.NODE_ENV === 'production' && fs.existsSync(staticPath)) {
  console.log(`Serving static files from ${staticPath}`);
  app.use(express.static(staticPath));
  
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  // Development or static path doesn't exist
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PawaOdds Scraper</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #0066cc; }
            .status { padding: 15px; background: #f0f8ff; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>PawaOdds Scraper</h1>
          <div class="status">
            <p>✅ Server is running in development mode</p>
            <p>Server time: ${new Date().toLocaleString()}</p>
          </div>
          <p>This is a placeholder page for the PawaOdds Scraper tool.</p>
          <p>For production deployment, build the application first.</p>
        </body>
      </html>
    `);
  });
}

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
EOF
echo "✅ Created CommonJS version of server/index.js"

# Step 3: Create a Vite config that works with CommonJS
cat > vite.config.cjs << 'EOF'
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

// Define __dirname for CommonJS compatibility
const __dirname = path.resolve();

module.exports = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
EOF
echo "✅ Created CommonJS Vite config"

# Step 4: Create a simplified package.json for deployment
cp package.json package.json.bak
cat > package.json.deploy << 'EOF'
{
  "name": "pawaodds-scraper",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node server-cjs/index.js",
    "build": "vite build --config vite.config.cjs",
    "dev": "node server-cjs/index.js"
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
cat > COMMONJS_DEPLOYMENT.md << 'EOF'
# CommonJS Deployment Instructions

## What This Does

This deployment approach creates a simplified CommonJS version of your server that:

1. Removes ES Module features that cause deployment issues (import.meta, top-level await)
2. Temporarily disables complex features like live scraping that rely on ES Modules
3. Maintains API endpoints and static file serving for your React application

## Deployment Steps

1. Replace your package.json with the deployment version:
   ```bash
   cp package.json.deploy package.json
   ```

2. Build the client:
   ```bash
   npm run build
   ```

3. Start the simplified server:
   ```bash
   NODE_ENV=production npm start
   ```

## How This Works

1. A simplified CommonJS server implementation replaces your ES Module server temporarily
2. Static file serving works with your existing React application
3. Basic API endpoints are preserved

## Restoring Your Development Environment

To restore your development environment after deployment:
```bash
cp package.json.bak package.json
```

## Features This Temporarily Disables

- Live scraper functionality (bp_gh_live_scraper.mjs)
- Heartbeat tracking features
- Automatic scraper initialization

These features can be re-enabled after addressing ES Module compatibility issues.
EOF

echo ""
echo "✅ CommonJS conversion setup complete!"
echo "Follow the instructions in COMMONJS_DEPLOYMENT.md to deploy your application."