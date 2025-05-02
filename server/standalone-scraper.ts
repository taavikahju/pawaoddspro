import { storage } from './storage';
import { runAllScrapers } from './scrapers/scheduler';
import { setTimeout } from 'timers/promises';

/**
 * This is a standalone script that runs scrapers on a schedule
 * for Replit deployment without requiring cron or PM2
 */
async function main() {
  console.log(`[${new Date().toISOString()}] Starting standalone scraper service...`);
  
  // Run the scrapers immediately on startup
  await runScraperCycle();
  
  // Continue running on a schedule
  while (true) {
    // Calculate time until next run (30 minutes)
    const INTERVAL_MINUTES = 30;
    const waitMs = INTERVAL_MINUTES * 60 * 1000;
    
    console.log(`[${new Date().toISOString()}] Next scraper run scheduled at ${new Date(Date.now() + waitMs).toISOString()}`);
    
    // Wait for the interval
    await setTimeout(waitMs);
    
    // Run the scrapers again
    await runScraperCycle();
  }
}

async function runScraperCycle() {
  console.log(`[${new Date().toISOString()}] Starting scraper cycle...`);
  
  try {
    // Run all scrapers
    await runAllScrapers(storage);
    console.log(`[${new Date().toISOString()}] Scraper cycle completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error running scrapers:`, error);
  }
}

// Start the scraper service
main().catch(err => {
  console.error('Fatal error in standalone scraper service:', err);
  process.exit(1);
});