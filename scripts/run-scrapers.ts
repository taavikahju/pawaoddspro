import { storage } from '../server/storage';
import { runAllScrapers } from '../server/scrapers/scheduler';

async function main() {
  console.log(`[${new Date().toISOString()}] Starting standalone scraper run...`);
  
  try {
    // Run all scrapers without setting up scheduled jobs
    await runAllScrapers(storage);
    console.log(`[${new Date().toISOString()}] Standalone scraper run completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error running scrapers:`, error);
  }
}

// Start the scraper run
main().catch(err => {
  console.error('Fatal error in standalone scraper:', err);
  process.exit(1);
});