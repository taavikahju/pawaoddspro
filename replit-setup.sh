#!/bin/bash
echo "===== SETTING UP PAWAODDS FOR REPLIT DEPLOYMENT ====="

# Step 1: Back up the original package.json
echo "Step 1: Backing up package.json..."
cp package.json package.json.original

# Step 2: Create a Replit-compatible package.json
echo "Step 2: Creating Replit-compatible package.json..."
cat > package.json << 'EOF'
{
  "name": "pawaodds-scraper",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node server-cjs.js",
    "dev": "node server-cjs.js",
    "build": "vite build",
    "postinstall": "echo 'Deployment ready!'"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.6.0",
    "axios": "^1.6.2",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "drizzle-orm": "^0.29.1",
    "express": "^4.18.2",
    "ws": "^8.14.2"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF

# Step 3: Install dependencies
echo "Step 3: Installing dependencies..."
npm install

# Step 4: Create a deployment guide
echo "Step 4: Creating deployment guide..."
cat > REPLIT_DEPLOYMENT_GUIDE.md << 'EOF'
# PawaOdds Replit Deployment Guide

This document explains how to deploy the PawaOdds application on Replit.

## What Works in This Deployment

- Basic API endpoints for bookmakers, events, and tournament margins
- Database integration (when DATABASE_URL is provided)
- WebSocket functionality for live updates
- Static file serving for the frontend (when built)

## Deployment Steps

1. **Environment Setup**:
   - Make sure the environment variable `DATABASE_URL` is set for PostgreSQL access
   - Optionally set `ADMIN_API_KEY` for admin route protection

2. **Running the Application**:
   - The application runs automatically on Replit using `npm start`
   - This executes `node server-cjs.js` which is the CommonJS-compatible entry point

3. **Building the Frontend**:
   - To build the frontend, run `npm run build`
   - This creates static files in the `dist/client` directory
   - The server will automatically serve these files if present

## Troubleshooting

- If database features don't work, check that `DATABASE_URL` is set correctly
- If you see module format errors, ensure all imports use CommonJS require() syntax
- For API issues, check the server logs for specific error messages

## Full Functionality Notes

- The live scraper has been simplified for Replit compatibility
- Tournament margin visualization works with sample data if database is unavailable
- Real-time updates rely on WebSocket connections to function properly

## Restoring Original Code

To restore the original application code:

```bash
cp package.json.original package.json
npm install
```

EOF

echo ""
echo "✅ Replit setup complete!"
echo "Run 'npm start' to start the application"
echo "See REPLIT_DEPLOYMENT_GUIDE.md for more information"