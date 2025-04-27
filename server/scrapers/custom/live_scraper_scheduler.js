/**
 * Live Scraper Scheduler
 * Runs the BetPawa Ghana live scraper every 10 seconds
 */

const bpGhLiveScraper = require('./bp_gh_live_scraper.js');
const EventEmitter = require('events');

// Create event emitter for live scraper events
const liveScraperEvents = new EventEmitter();

// Live scraper events
const LIVE_SCRAPER_EVENTS = {
  STARTED: 'live-scraper:started',
  COMPLETED: 'live-scraper:completed',
  ERROR: 'live-scraper:error',
  MARKET_CHANGE: 'live-scraper:market-change',
};

let isLiveScraping = false;
let liveScrapeInterval = null;
let previousMarketStatus = {}; // To track changes in market availability

/**
 * Start the live scraper scheduler
 */
function startLiveScraper(apiUrl) {
  if (liveScrapeInterval) {
    console.log('Live scraper is already running');
    return;
  }
  
  console.log('Starting BetPawa Ghana live scraper...');
  liveScraperEvents.emit(LIVE_SCRAPER_EVENTS.STARTED, {
    timestamp: new Date().toISOString(),
    message: 'Live scraper started with 10-second interval'
  });
  
  // Run first scrape immediately
  runLiveScrape(apiUrl);
  
  // Set up interval to run every 10 seconds
  liveScrapeInterval = setInterval(() => {
    runLiveScrape(apiUrl);
  }, 10000);
}

/**
 * Stop the live scraper scheduler
 */
function stopLiveScraper() {
  if (liveScrapeInterval) {
    clearInterval(liveScrapeInterval);
    liveScrapeInterval = null;
    isLiveScraping = false;
    console.log('Live scraper stopped');
    liveScraperEvents.emit(LIVE_SCRAPER_EVENTS.COMPLETED, {
      timestamp: new Date().toISOString(),
      message: 'Live scraper stopped'
    });
  }
}

/**
 * Run a single live scrape
 */
async function runLiveScrape(apiUrl) {
  if (isLiveScraping) {
    console.log('Previous live scrape still running, skipping this run');
    return;
  }
  
  isLiveScraping = true;
  
  try {
    const events = await bpGhLiveScraper.scrapeLiveEvents(apiUrl);
    
    // Check for market status changes
    checkForMarketChanges(events);
    
    isLiveScraping = false;
    
    liveScraperEvents.emit(LIVE_SCRAPER_EVENTS.COMPLETED, {
      timestamp: new Date().toISOString(),
      message: `Live scrape completed, fetched ${events.length} events`
    });
  } catch (error) {
    isLiveScraping = false;
    console.error('Error running live scrape:', error.message);
    
    liveScraperEvents.emit(LIVE_SCRAPER_EVENTS.ERROR, {
      timestamp: new Date().toISOString(),
      message: `Live scrape error: ${error.message}`
    });
  }
}

/**
 * Check for changes in market availability and emit events
 */
function checkForMarketChanges(events) {
  events.forEach(event => {
    const eventId = event.id;
    const previousStatus = previousMarketStatus[eventId];
    
    // If we have a previous status and it's different from current, emit change event
    if (previousStatus !== undefined && previousStatus !== event.market1X2Available) {
      liveScraperEvents.emit(LIVE_SCRAPER_EVENTS.MARKET_CHANGE, {
        timestamp: new Date().toISOString(),
        eventId: eventId,
        eventName: event.name,
        previousStatus: previousStatus,
        currentStatus: event.market1X2Available,
        message: `Market status changed for ${event.name}: ${previousStatus ? 'Available' : 'Suspended'} → ${event.market1X2Available ? 'Available' : 'Suspended'}`
      });
    }
    
    // Update previous status
    previousMarketStatus[eventId] = event.market1X2Available;
  });
}

/**
 * Get live scraper status
 */
function getLiveScraperStatus() {
  return {
    isRunning: liveScrapeInterval !== null,
    marketStats: bpGhLiveScraper.getMarketAvailabilityStats()
  };
}

// Export for both CommonJS and ESM
if (typeof module !== 'undefined') {
  module.exports = {
    startLiveScraper,
    stopLiveScraper,
    getLiveScraperStatus,
    liveScraperEvents,
    LIVE_SCRAPER_EVENTS
  };
}

// ESM exports
export {
  startLiveScraper,
  stopLiveScraper,
  getLiveScraperStatus,
  liveScraperEvents,
  LIVE_SCRAPER_EVENTS
};