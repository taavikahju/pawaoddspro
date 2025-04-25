import { EventEmitter } from 'events';
import { Request, Response, Application } from 'express';
import { isAuthenticated, isAdmin } from '../../middleware/auth';
import { createRequire } from 'module';

// Create a require function
const require = createRequire(import.meta.url);

// Use require to import the CommonJS module
const { scrapeLiveEvents, getMarketAvailabilityStats } = require('./bp_gh_live_scraper');

// Event emitter for live scraper events
export const liveScraperEvents = new EventEmitter();

// Event types
export const LIVE_SCRAPER_EVENTS = {
  STARTED: 'live_scraper_started',
  STOPPED: 'live_scraper_stopped',
  DATA_UPDATED: 'live_scraper_data_updated',
  COMPLETED: 'live_scraper_completed', // For compatibility with routes.ts
  MARKET_CHANGE: 'live_scraper_market_change', // For compatibility with routes.ts
  ERROR: 'live_scraper_error'
};

// Scraper state
let isRunning = false;
let apiUrl: string | null = null;
let scraperInterval: NodeJS.Timeout | null = null;
const SCRAPE_INTERVAL = 10000; // 10 seconds

/**
 * Start the live scraper
 */
export function startLiveScraper(url: string): void {
  if (isRunning) {
    return;
  }
  
  apiUrl = url;
  isRunning = true;
  
  // Run immediately
  runScraper();
  
  // Schedule recurring runs
  scraperInterval = setInterval(runScraper, SCRAPE_INTERVAL);
  
  liveScraperEvents.emit(LIVE_SCRAPER_EVENTS.STARTED, {
    timestamp: new Date().toISOString(),
    message: 'BetPawa Ghana live scraper started'
  });
  
  console.log('BetPawa Ghana live scraper started');
}

/**
 * Run a single scraper cycle
 */
async function runScraper(): Promise<void> {
  try {
    if (!apiUrl) {
      throw new Error('No API URL configured');
    }
    
    console.log('Running BetPawa Ghana live scraper...');
    const events = await scrapeLiveEvents(apiUrl);
    
    liveScraperEvents.emit(LIVE_SCRAPER_EVENTS.DATA_UPDATED, {
      timestamp: new Date().toISOString(),
      eventCount: events.length,
      message: `Scraped ${events.length} live events`,
      stats: getMarketAvailabilityStats()
    });
  } catch (error) {
    console.error('Error in BetPawa Ghana live scraper:', error);
    
    liveScraperEvents.emit(LIVE_SCRAPER_EVENTS.ERROR, {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Error in BetPawa Ghana live scraper'
    });
  }
}

/**
 * Stop the live scraper
 */
export function stopLiveScraper(): void {
  if (!isRunning) {
    return;
  }
  
  if (scraperInterval) {
    clearInterval(scraperInterval);
    scraperInterval = null;
  }
  
  isRunning = false;
  
  liveScraperEvents.emit(LIVE_SCRAPER_EVENTS.STOPPED, {
    timestamp: new Date().toISOString(),
    message: 'BetPawa Ghana live scraper stopped'
  });
  
  console.log('BetPawa Ghana live scraper stopped');
}

/**
 * Get the current status of the live scraper
 */
export function getLiveScraperStatus() {
  return {
    isRunning,
    marketStats: getMarketAvailabilityStats()
  };
}

// The routes are already defined in server/routes.ts
// This function is kept for reference but not used anymore
// export function registerLiveScraperRoutes(app: Application): void { ... }