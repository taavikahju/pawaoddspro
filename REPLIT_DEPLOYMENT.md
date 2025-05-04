# Replit Deployment Guide

This guide explains how to ensure that scrapers run consistently every 5 minutes on Replit's hosting platform.

## Step 1: Enable "Always On"

First, make sure your Replit project is set to "Always On":

1. Go to your project dashboard
2. Click on the "Tools" menu
3. Select "Secrets"
4. Enable the "Always On" toggle

This ensures your application keeps running even when you're not accessing it.

## Step 2: Use the Provided Shell Script (Recommended)

We've created a shell script that starts both the main application and the standalone scraper:

1. Make sure the script is executable:
   ```bash
   chmod +x start-replit.sh
   ```

2. Run the script:
   ```bash
   ./start-replit.sh
   ```

This script:
- Starts both the main application and the standalone scraper
- Redirects output to log files
- Saves the process IDs for easy management
- Automatically terminates both processes when one exits

## Step 3: Alternative - Create a Custom JavaScript Start Script

Create a file called `start-replit.js` in your project root:

```javascript
// start-replit.js
const { spawn } = require('child_process');
const path = require('path');

// Start the main application
const mainApp = spawn('node', ['dist/server/index.js'], {
  stdio: 'inherit'
});

console.log(`[${new Date().toISOString()}] Main application started with PID: ${mainApp.pid}`);

// Start the standalone scraper
const scraper = spawn('node', ['dist/server/standalone-scraper.js'], {
  stdio: 'inherit'
});

console.log(`[${new Date().toISOString()}] Standalone scraper started with PID: ${scraper.pid}`);

// Handle process exit
process.on('SIGINT', () => {
  console.log('Shutting down...');
  mainApp.kill();
  scraper.kill();
  process.exit(0);
});

// Handle child process exit
mainApp.on('close', (code) => {
  console.log(`Main application exited with code ${code}`);
});

scraper.on('close', (code) => {
  console.log(`Standalone scraper exited with code ${code}`);
});
```

## Step 3: Update package.json

Edit your package.json to add a script to start both processes:

```json
"scripts": {
  // ... other scripts
  "start:replit": "node start-replit.js"
}
```

## Step 4: Deploy to Replit

When deploying to Replit, you have two options:

### Option 1: Manual Start

After deploying, you can manually start the scraper by running:

```bash
node dist/server/standalone-scraper.js &
```

The `&` at the end runs the process in the background.

### Option 2: Use Replit's Run Command (Shell)

In your Replit, you can create a shell command that runs both processes:

1. Go to the Shell tab
2. Run the following command:
```bash
npm start & node dist/server/standalone-scraper.js &
```

## Verifying the Scraper is Running

To check if your scraper is running:

```bash
ps aux | grep standalone-scraper
```

If you see output listing the process, it's running correctly.

## Troubleshooting

If the scraper stops running:

1. Check if the process is still running:
```bash
ps aux | grep standalone-scraper
```

2. If not, restart it:
```bash
node dist/server/standalone-scraper.js &
```

3. Check the logs for any errors:
```bash
tail -f logs/standalone-scraper.log
```

By using the standalone-scraper implementation with the built-in 5-minute interval and resilience features, your scrapers will continue to run even if Replit occasionally restarts your project.