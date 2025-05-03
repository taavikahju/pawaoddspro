import { storage } from './storage';
import { runAllScrapers } from './scrapers/scheduler';
import { setTimeout } from 'timers/promises';

/**
 * This is a standalone script that runs scrapers on a schedule
 * for Replit deployment without requiring cron or PM2
 */
async function main() {
  console.log(`[${new Date().toISOString()}] Starting standalone scraper service...`);
  
  // Track consecutive failures for backoff strategy
  let consecutiveFailures = 0;
  
  // Run the scrapers immediately on startup
  try {
    await runScraperCycle();
    // Reset consecutive failures on success
    consecutiveFailures = 0;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Initial scraper run failed:`, error);
    consecutiveFailures++;
  }
  
  // Continue running on a schedule
  while (true) {
    try {
      // Calculate time until next run (15 minutes)
      const INTERVAL_MINUTES = 15;
      
      // Apply exponential backoff if we've had failures (max 30 minutes)
      const backoffFactor = Math.min(Math.pow(2, consecutiveFailures - 1), 2);
      const adjustedInterval = consecutiveFailures > 0 
        ? Math.min(INTERVAL_MINUTES * backoffFactor, 30) 
        : INTERVAL_MINUTES;
      
      const waitMs = Math.floor(adjustedInterval * 60 * 1000);
      
      console.log(`[${new Date().toISOString()}] Next scraper run scheduled at ${new Date(Date.now() + waitMs).toISOString()}`);
      
      // Show message if we're using backoff
      if (consecutiveFailures > 0) {
        console.log(`[${new Date().toISOString()}] Using backoff strategy after ${consecutiveFailures} consecutive failures (waiting ${adjustedInterval} minutes)`);
      }
      
      // Wait for the interval
      await setTimeout(waitMs);
      
      // Run the scrapers again
      await runScraperCycle();
      
      // Reset consecutive failures on success
      consecutiveFailures = 0;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in scraper schedule loop:`, error);
      consecutiveFailures++;
      
      // Short wait before retrying after an error in the main loop
      await setTimeout(10000); // 10 seconds
    }
  }
}

async function runScraperCycle() {
  console.log(`[${new Date().toISOString()}] Starting scraper cycle...`);
  
  try {
    // Run all scrapers
    await runAllScrapers(storage);
    console.log(`[${new Date().toISOString()}] Scraper cycle completed successfully`);
    
    // Save the last successful run timestamp to a file
    try {
      const fs = require('fs');
      const timestamp = new Date().toISOString();
      fs.writeFileSync('last_successful_scrape.txt', timestamp);
      console.log(`[${new Date().toISOString()}] Saved successful run timestamp: ${timestamp}`);
    } catch (fileError) {
      console.warn(`[${new Date().toISOString()}] Could not save timestamp file:`, fileError);
    }
    
    return true; // Indicate success
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error running scrapers:`, error);
    // Re-throw the error so the calling function knows there was a failure
    // This is important for the exponential backoff to work
    throw error;
  }
}

// Start the scraper service
main().catch(err => {
  console.error('Fatal error in standalone scraper service:', err);
  process.exit(1);
});