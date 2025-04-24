import cron from 'node-cron';
import { IStorage } from '../storage';
import * as bet365Scraper from './bet365';
import * as williamHillScraper from './williamhill';
import * as betfairScraper from './betfair';
import * as paddyPowerScraper from './paddypower';
import * as customScrapers from './custom/integration';
import { processAndMapEvents } from '../utils/dataMapper';
import { EventEmitter } from 'events';

// Create event emitter for scraper events
export const scraperEvents = new EventEmitter();

// Define event types
export const SCRAPER_EVENTS = {
  STARTED: 'scraper:started',
  COMPLETED: 'scraper:completed',
  FAILED: 'scraper:failed',
  BOOKMAKER_STARTED: 'scraper:bookmaker:started',
  BOOKMAKER_COMPLETED: 'scraper:bookmaker:completed',
  BOOKMAKER_FAILED: 'scraper:bookmaker:failed',
  PROCESSING_STARTED: 'scraper:processing:started',
  PROCESSING_COMPLETED: 'scraper:processing:completed',
  PROCESSING_FAILED: 'scraper:processing:failed',
  // Additional events needed for our notification system
  SCRAPER_STARTED: 'scraper:individual:started',
  SCRAPER_COMPLETED: 'scraper:individual:completed',
  SCRAPER_FAILED: 'scraper:individual:failed',
  ALL_SCRAPERS_COMPLETED: 'scraper:all:completed'
};

// Schedule to run every 15 minutes
const SCRAPE_SCHEDULE = '*/15 * * * *';

// Keep track of running jobs
let scheduledJob: cron.ScheduledTask | null = null;

/**
 * Setup all scrapers and schedule them to run
 */
export function setupScrapers(storage: IStorage): void {
  console.log('Setting up scrapers...');
  
  // Run scrapers immediately on startup
  runAllScrapers(storage)
    .then(() => console.log('Initial scraping completed'))
    .catch(err => console.error('Error during initial scraping:', err));
  
  // Schedule regular runs
  if (scheduledJob) {
    scheduledJob.stop();
  }
  
  scheduledJob = cron.schedule(SCRAPE_SCHEDULE, async () => {
    try {
      console.log(`Running scheduled scrape at ${new Date().toLocaleTimeString()}`);
      await runAllScrapers(storage);
      console.log('Scheduled scraping completed');
    } catch (error) {
      console.error('Error during scheduled scraping:', error);
    }
  });
  
  console.log(`Scrapers scheduled to run every 15 minutes (cron: ${SCRAPE_SCHEDULE})`);
}

/**
 * Run all scrapers in sequence
 */
export async function runAllScrapers(storage: IStorage): Promise<void> {
  try {
    console.log('Starting scraper runs...');
    
    // Emit scraper started event
    scraperEvents.emit(SCRAPER_EVENTS.STARTED, {
      timestamp: new Date().toISOString(),
      message: 'Starting scraper runs'
    });
    
    // Get all bookmakers
    const bookmakers = await storage.getBookmakers();
    
    // Run scrapers in parallel
    const scraperPromises = bookmakers
      .filter(bookmaker => bookmaker.active)
      .map(async (bookmaker) => {
        try {
          console.log(`Running scraper for ${bookmaker.name}...`);
          
          // Emit bookmaker scraper started event
          scraperEvents.emit(SCRAPER_EVENTS.BOOKMAKER_STARTED, {
            timestamp: new Date().toISOString(),
            bookmaker: {
              code: bookmaker.code,
              name: bookmaker.name
            },
            message: `Running scraper for ${bookmaker.name}`
          });
          
          let data: any = null;
          
          // Check if custom scraper exists
          const hasCustom = customScrapers.hasCustomScraper(bookmaker.code);
          
          // Try to use custom scraper
          if (hasCustom) {
            try {
              // Use the custom scraper
              console.log(`Using custom scraper for ${bookmaker.name}...`);
              data = await customScrapers.runCustomScraper(bookmaker.code);
            } catch (customError) {
              console.error(`Error in custom scraper for ${bookmaker.name}:`, customError);
              data = null;
            }
          }
          
          // Only use custom scrapers, no fallbacks to mock scrapers
          if (!data) {
            console.warn(`No custom scraper found for bookmaker ${bookmaker.code}`);
            
            // Emit bookmaker scraper failed event
            scraperEvents.emit(SCRAPER_EVENTS.BOOKMAKER_FAILED, {
              timestamp: new Date().toISOString(),
              bookmaker: {
                code: bookmaker.code,
                name: bookmaker.name
              },
              message: `No custom scraper found for bookmaker ${bookmaker.code}`,
              error: 'No custom scraper available'
            });
            
            return null;
          }
          
          if (data) {
            await storage.saveBookmakerData(bookmaker.code, data);
            console.log(`Saved data for ${bookmaker.name}`);
            
            // Emit bookmaker scraper completed event
            scraperEvents.emit(SCRAPER_EVENTS.BOOKMAKER_COMPLETED, {
              timestamp: new Date().toISOString(),
              bookmaker: {
                code: bookmaker.code,
                name: bookmaker.name
              },
              message: `Completed scraping for ${bookmaker.name}`,
              eventCount: Array.isArray(data) ? data.length : 0
            });
          }
          
          return { bookmaker: bookmaker.code, data };
        } catch (error) {
          console.error(`Error scraping ${bookmaker.name}:`, error);
          
          // Emit bookmaker scraper failed event
          scraperEvents.emit(SCRAPER_EVENTS.BOOKMAKER_FAILED, {
            timestamp: new Date().toISOString(),
            bookmaker: {
              code: bookmaker.code,
              name: bookmaker.name
            },
            message: `Error scraping ${bookmaker.name}`,
            error: error instanceof Error ? error.message : String(error)
          });
          
          return { bookmaker: bookmaker.code, error, data: null };
        }
      });
    
    // Wait for all scrapers to complete
    const results = await Promise.all(scraperPromises);
    console.log('All scrapers completed');
    
    // Emit processing started event
    scraperEvents.emit(SCRAPER_EVENTS.PROCESSING_STARTED, {
      timestamp: new Date().toISOString(),
      message: 'Processing and mapping events'
    });
    
    try {
      // Process and map events
      await processAndMapEvents(storage);
      
      // Emit processing completed event
      scraperEvents.emit(SCRAPER_EVENTS.PROCESSING_COMPLETED, {
        timestamp: new Date().toISOString(),
        message: 'Completed processing and mapping events'
      });
    } catch (processingError) {
      console.error('Error processing events:', processingError);
      
      // Emit processing failed event
      scraperEvents.emit(SCRAPER_EVENTS.PROCESSING_FAILED, {
        timestamp: new Date().toISOString(),
        message: 'Error processing and mapping events',
        error: processingError instanceof Error ? processingError.message : String(processingError)
      });
      
      throw processingError;
    }
    
    // Update stats
    const stats = await storage.getStats();
    
    // Emit scraper completed event
    scraperEvents.emit(SCRAPER_EVENTS.COMPLETED, {
      timestamp: new Date().toISOString(),
      message: 'All scrapers completed successfully',
      stats
    });
    
  } catch (error) {
    console.error('Error running scrapers:', error);
    
    // Emit scraper failed event
    scraperEvents.emit(SCRAPER_EVENTS.FAILED, {
      timestamp: new Date().toISOString(),
      message: 'Error running scrapers',
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error;
  }
}

/**
 * Stop all scheduled jobs
 */
export function stopScrapers(): void {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    console.log('Scrapers stopped');
  }
}
