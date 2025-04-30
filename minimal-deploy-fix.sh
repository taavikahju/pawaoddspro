#!/bin/bash

echo "===== MINIMAL DEPLOYMENT FIX SCRIPT ====="
echo "This script does the minimal changes needed for Replit deployment"

# Back up original package.json
cp package.json package.json.original

# Generate a simplified package.json for deployment
cat > package.json << 'EOF'
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "dev": "node server/index.js",
    "build": "vite build && node build-server.js",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@neondatabase/serverless": "^0.8.1",
    "@tailwindcss/typography": "^0.5.10",
    "@tanstack/react-query": "^5.27.2",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "axios": "^1.6.7",
    "clsx": "^2.1.0",
    "connect-pg-simple": "^9.0.1",
    "drizzle-orm": "^0.30.0",
    "drizzle-zod": "^0.5.1",
    "esbuild": "^0.20.2",
    "express": "^4.18.3",
    "express-session": "^1.18.0",
    "lucide-react": "^0.338.0",
    "memorystore": "^1.6.7",
    "node-cron": "^3.0.3",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "postcss": "^8.4.35",
    "react": "^18.2.0",
    "react-country-flag": "^3.1.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.51.0",
    "react-icons": "^5.0.1",
    "tailwindcss": "^3.4.1",
    "tailwindcss-animate": "^1.0.7",
    "vite": "^5.1.6",
    "wouter": "^3.0.0",
    "ws": "^8.16.0",
    "zod": "^3.22.4"
  }
}
EOF

# Create PostCSS config
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer'),
  ]
};
EOF

# Create simple vite config
cat > vite.config.js << 'EOF'
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

module.exports = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    outDir: "dist/client",
  },
});
EOF

# Create a simplified server build script
cat > build-server.js << 'EOF'
const { build } = require('esbuild');
const path = require('path');

async function buildServer() {
  try {
    await build({
      entryPoints: ['server/index.js'],
      bundle: true,
      platform: 'node',
      target: 'node16',
      outfile: 'dist/index.js',
      format: 'cjs',
      external: ['pg-native', 'canvas', 'aws-crt', 'utf-8-validate', 'bufferutil'],
    });
    console.log('✅ Server build complete');
  } catch (err) {
    console.error('❌ Server build failed:', err);
    process.exit(1);
  }
}

buildServer();
EOF

# Convert server/index.ts to server/index.js
cat > server/index.js << 'EOF'
const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { storage } = require('./storage');

const app = express();
app.use(express.json());

// Setup basic middlewares
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

// Error handling
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// API Routes
app.get('/api/events', async (req, res) => {
  try {
    const events = await storage.getEvents();
    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await storage.getStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

app.get('/api/bookmakers', async (req, res) => {
  try {
    const bookmakers = await storage.getBookmakers();
    res.json(bookmakers);
  } catch (err) {
    console.error('Error fetching bookmakers:', err);
    res.status(500).json({ message: 'Failed to fetch bookmakers' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
const server = createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
EOF

echo "✅ Minimal deployment files created"
echo ""
echo "Now deploy using the Replit deploy button"
echo "After deployment, restore your development files with:"
echo "  mv package.json.original package.json"