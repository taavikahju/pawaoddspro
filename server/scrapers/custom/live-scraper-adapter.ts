import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// Define types for the imported modules
interface LiveScraperScheduler {
  liveScraperEvents: EventEmitter;
  startLiveScraper: (apiUrl: string) => void;
  stopLiveScraper: () => void;
  getLiveScraperStatus: () => any;
}

interface BpGhLiveScraper {
  scrapeLiveEvents: (apiUrl: string) => Promise<any[]>;
  getMarketAvailabilityStats: () => any;
}

// We'll load these dynamically
let liveScraperScheduler: LiveScraperScheduler;
let bpGhLiveScraper: BpGhLiveScraper;

// Function to dynamically load the modules
async function loadModules() {
  // Check if the files exist
  const schedulerPath = path.join(process.cwd(), 'server', 'scrapers', 'custom', 'live_scraper_scheduler.js');
  const scraperPath = path.join(process.cwd(), 'server', 'scrapers', 'custom', 'bp_gh_live_scraper.js');
  
  if (!fs.existsSync(schedulerPath)) {
    throw new Error(`Scheduler module not found at: ${schedulerPath}`);
  }
  
  if (!fs.existsSync(scraperPath)) {
    throw new Error(`Live scraper module not found at: ${scraperPath}`);
  }
  
  // Use dynamic import for ESM compatibility
  const schedulerModule = await import(schedulerPath);
  const scraperModule = await import(scraperPath);
  
  liveScraperScheduler = schedulerModule.default || schedulerModule;
  bpGhLiveScraper = scraperModule.default || scraperModule;
}

// Initialize the modules
loadModules().catch(err => {
  console.error('Error loading live scraper modules:', err);
});

// Re-export the constants
export const LIVE_SCRAPER_EVENTS = {
  STARTED: 'live-scraper:started',
  COMPLETED: 'live-scraper:completed',
  ERROR: 'live-scraper:error',
  MARKET_CHANGE: 'live-scraper:market-change',
};

// Create a dummy event emitter to use until the real one is loaded
const dummyEmitter = new EventEmitter();

// Export the functions and objects with dynamic loading
export const liveScraperEvents: EventEmitter = dummyEmitter;

export async function startLiveScraper(apiUrl: string): Promise<void> {
  try {
    await loadModules();
    return liveScraperScheduler.startLiveScraper(apiUrl);
  } catch (error) {
    console.error('Error starting live scraper:', error);
    throw error;
  }
}

export async function stopLiveScraper(): Promise<void> {
  try {
    await loadModules();
    return liveScraperScheduler.stopLiveScraper();
  } catch (error) {
    console.error('Error stopping live scraper:', error);
    throw error;
  }
}

export async function getLiveScraperStatus(): Promise<any> {
  try {
    await loadModules();
    return liveScraperScheduler.getLiveScraperStatus();
  } catch (error) {
    console.error('Error getting live scraper status:', error);
    return {
      isRunning: false,
      marketStats: {
        totalEvents: 0,
        availableMarkets: 0,
        suspendedMarkets: 0,
        eventDetails: []
      }
    };
  }
}

export async function scrapeLiveEvents(apiUrl: string): Promise<any[]> {
  try {
    await loadModules();
    return bpGhLiveScraper.scrapeLiveEvents(apiUrl);
  } catch (error) {
    console.error('Error scraping live events:', error);
    return [];
  }
}

export async function getMarketAvailabilityStats(): Promise<any> {
  try {
    await loadModules();
    return bpGhLiveScraper.getMarketAvailabilityStats();
  } catch (error) {
    console.error('Error getting market availability stats:', error);
    return {
      totalEvents: 0,
      availableMarkets: 0,
      suspendedMarkets: 0,
      eventDetails: []
    };
  }
}