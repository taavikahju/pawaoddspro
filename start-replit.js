// start-replit.js - Script to run both the main app and standalone scraper
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log files
const mainLogFile = fs.openSync(path.join(logsDir, 'main-app.log'), 'a');
const scraperLogFile = fs.openSync(path.join(logsDir, 'standalone-scraper.log'), 'a');

console.log(`[${new Date().toISOString()}] Starting all services...`);

// Start the main application
const mainApp = spawn('node', ['dist/server/index.js'], {
  stdio: ['ignore', mainLogFile, mainLogFile]
});

console.log(`[${new Date().toISOString()}] Main application started with PID: ${mainApp.pid}`);

// Start the standalone scraper
const scraper = spawn('node', ['dist/server/standalone-scraper.js'], {
  stdio: ['ignore', scraperLogFile, scraperLogFile]
});

console.log(`[${new Date().toISOString()}] Standalone scraper started with PID: ${scraper.pid}`);

// Handle process exit
process.on('SIGINT', () => {
  console.log('Shutting down...');
  mainApp.kill();
  scraper.kill();
  process.exit(0);
});

// Auto-restart the main app if it crashes
mainApp.on('close', (code) => {
  console.log(`[${new Date().toISOString()}] Main application exited with code ${code}`);
  
  // Wait 5 seconds before restarting
  console.log(`[${new Date().toISOString()}] Restarting main application in 5 seconds...`);
  setTimeout(() => {
    const newMainApp = spawn('node', ['dist/server/index.js'], {
      stdio: ['ignore', mainLogFile, mainLogFile]
    });
    console.log(`[${new Date().toISOString()}] Main application restarted with PID: ${newMainApp.pid}`);
    
    // Update the reference to the new process
    mainApp.removeAllListeners();
    mainApp.pid = newMainApp.pid;
  }, 5000);
});

// Auto-restart the scraper if it crashes
scraper.on('close', (code) => {
  console.log(`[${new Date().toISOString()}] Standalone scraper exited with code ${code}`);
  
  // Wait 5 seconds before restarting
  console.log(`[${new Date().toISOString()}] Restarting standalone scraper in 5 seconds...`);
  setTimeout(() => {
    const newScraper = spawn('node', ['dist/server/standalone-scraper.js'], {
      stdio: ['ignore', scraperLogFile, scraperLogFile]
    });
    console.log(`[${new Date().toISOString()}] Standalone scraper restarted with PID: ${newScraper.pid}`);
    
    // Update the reference to the new process
    scraper.removeAllListeners();
    scraper.pid = newScraper.pid;
  }, 5000);
});