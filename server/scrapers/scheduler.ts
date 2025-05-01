import cron from 'node-cron';
import { IStorage } from '../storage';
import * as bet365Scraper from './bet365';
import * as williamHillScraper from './williamhill';
import * as betfairScraper from './betfair';
import * as paddyPowerScraper from './paddypower';
import * as customScrapers from './custom/integration';
import { processAndMapEvents } from '../utils/dataMapper';
import { EventEmitter } from 'events';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

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
  // Event for when all scraping and mapping is finished - ready for frontend
  ALL_PROCESSING_COMPLETED: 'scraper:all:processing:completed',
  ALL_SCRAPERS_COMPLETED: 'scraper:all:completed'
};

// Schedule to run every 15 minutes
const SCRAPE_SCHEDULE = '*/15 * * * *';

// Schedule to run history cleanup once a day at midnight
const CLEANUP_SCHEDULE = '0 0 * * *';

// Keep track of running jobs
let scheduledJob: cron.ScheduledTask | null = null;
let cleanupJob: cron.ScheduledTask | null = null;

/**
 * Setup all scrapers and schedule them to run
 */
export function setupScrapers(storage: IStorage): void {
  logger.critical('Setting up scraper services');
  
  // Run scrapers immediately on startup
  runAllScrapers(storage)
    .then(() => logger.critical('Initial scraping completed'))
    .catch(err => logger.error('Error during initial scraping:', err));
  
  // Schedule regular scraper runs
  if (scheduledJob) {
    scheduledJob.stop();
  }
  
  scheduledJob = cron.schedule(SCRAPE_SCHEDULE, async () => {
    try {
      // More concise logging
      logger.scraperStart(new Date().toLocaleTimeString());
      await runAllScrapers(storage);
      // No need for completion message as the scraper itself will log its summary
    } catch (error) {
      logger.error('Scheduled scraping failed:', error);
    }
  });
  
  logger.info('Scrapers will run every 15 minutes');
  
  // Schedule daily cleanup job to remove old history data
  if (cleanupJob) {
    cleanupJob.stop();
  }
  
  cleanupJob = cron.schedule(CLEANUP_SCHEDULE, async () => {
    try {
      logger.info(`Running history cleanup [${new Date().toLocaleTimeString()}]`);
      
      // Clean up odds history
      const { cleanupOldOddsHistory } = await import('../utils/oddsHistory');
      const deletedOddsCount = await cleanupOldOddsHistory(30); // Delete data older than 30 days (1 month)
      logger.info(`Odds history cleanup: removed ${deletedOddsCount} records`);
      
      // Clean up tournament margins
      const { cleanupOldTournamentMargins } = await import('../utils/tournamentMargins');
      const deletedMarginsCount = await cleanupOldTournamentMargins(30); // Delete data older than 30 days (1 month)
      logger.info(`Tournament margins cleanup: removed ${deletedMarginsCount} records`);
      
      // Log total
      logger.critical(`Total cleanup: removed ${deletedOddsCount + deletedMarginsCount} records`);
    } catch (error) {
      logger.error('History cleanup failed:', error);
    }
  });
  
  logger.info('History cleanup will run daily at midnight');
}

/**
 * Run all scrapers in sequence
 */
export async function runAllScrapers(storage: IStorage): Promise<void> {
  try {
    const startTime = new Date();
    logger.critical(`[${startTime.toISOString()}] Starting scraper runs`);
    
    // Emit scraper started event
    scraperEvents.emit(SCRAPER_EVENTS.STARTED, {
      timestamp: startTime.toISOString(),
      message: 'Starting scraper runs'
    });
    
    // Get all bookmakers
    const bookmakers = await storage.getBookmakers();
    const activeBookmakers = bookmakers.filter(bookmaker => bookmaker.active);
    
    logger.info(`Processing ${activeBookmakers.length} active bookmakers`);
    
    // Sort the bookmakers to process them in a specific order
    // 1. First process betPawa Ghana (bp GH) as the base for countries/tournaments
    // 2. Then process Sportybet to ensure consistent event IDs
    // 3. Then process all other bookmakers
    const sortedBookmakers = [...activeBookmakers].sort((a, b) => {
      if (a.code === 'bp GH') return -1; // betPawa Ghana should be first
      if (b.code === 'bp GH') return 1;
      if (a.code === 'sporty') return -1; // Sportybet should be second
      if (b.code === 'sporty') return 1;
      return 0; // Keep the original order for other bookmakers
    });
    
    logger.info(`Scraping in optimized order: ${sortedBookmakers.map(b => b.code).join(', ')}`);
    
    // Run all scrapers in parallel for faster completion time
    // We'll still update frontend only once everything is done
    const scraperPromises = sortedBookmakers.map(async (bookmaker) => {
      try {
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
            // Use custom scraper with clear timestamp-based logging
            const scraperStartTime = new Date();
            logger.critical(`[${scraperStartTime.toISOString()}] Starting ${bookmaker.name} scraper`);
            
            data = await customScrapers.runCustomScraper(bookmaker.code);
            
            const scraperEndTime = new Date();
            logger.critical(`[${scraperEndTime.toISOString()}] ${bookmaker.name} scraper finished - ${data?.length || 0} events extracted`);
          } catch (customError) {
            const errorTime = new Date();
            logger.critical(`[${errorTime.toISOString()}] Error in ${bookmaker.name} scraper: ${customError.message || String(customError)}`);
            data = null;
          }
        }
        
        // Only use custom scrapers, no fallbacks to mock scrapers
        if (!data) {
          logger.info(`No scraper for ${bookmaker.code}`);
          
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
          // Event count already logged after scraper completes, avoid duplicate logs
          const eventCount = Array.isArray(data) ? data.length : 0;
          
          // Emit bookmaker scraper completed event
          scraperEvents.emit(SCRAPER_EVENTS.BOOKMAKER_COMPLETED, {
            timestamp: new Date().toISOString(),
            bookmaker: {
              code: bookmaker.code,
              name: bookmaker.name
            },
            message: `Completed scraping for ${bookmaker.name}`,
            eventCount
          });
        }
        
        return { bookmaker: bookmaker.code, data };
      } catch (error) {
        console.error(`❌ ${bookmaker.name} scraper failed:`, error);
        
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
    
    // Count successful scrapers and log detailed event counts
    const successfulScrapers = results.filter(r => r && r.data).length;
    
    // Total events scraped - simplified logging
    const totalScrapedEvents = results.reduce((total, r) => total + (r?.data?.length || 0), 0);
    logger.critical(`Total events scraped: ${totalScrapedEvents}`);
    
    logger.critical(`${successfulScrapers}/${activeBookmakers.length} scrapers completed successfully`);
    
    logger.critical(`Processing and mapping events...`);
    // Emit processing started event
    scraperEvents.emit(SCRAPER_EVENTS.PROCESSING_STARTED, {
      timestamp: new Date().toISOString(),
      message: 'Processing and mapping events'
    });
    
    try {
      // Process and map events
      await processAndMapEvents(storage);
      
      // Calculate and store tournament margins
      try {
        const { calculateAndStoreTournamentMargins } = await import('../utils/tournamentMargins');
        
        // Calculate and store new tournament margins
        // Note: We no longer delete existing margins to maintain historical data
        await calculateAndStoreTournamentMargins(storage);
        console.log('✅ Tournament margins calculated and stored');
      } catch (marginError) {
        console.error('❌ Error calculating tournament margins:', marginError);
      }
      
      // Emit processing completed event
      scraperEvents.emit(SCRAPER_EVENTS.PROCESSING_COMPLETED, {
        timestamp: new Date().toISOString(),
        message: 'Completed processing and mapping events'
      });
      
      // Emit event that all processing is complete and frontend can be updated
      // This includes statistics that will be logged and sent to frontend
      const allEvents = await storage.getEvents();
      const filteredEvents = allEvents.filter(event => {
        if (!event.oddsData) return false;
        const bookmakerCount = Object.keys(event.oddsData as Record<string, any>).length;
        return bookmakerCount >= 2;
      });
      
      // Create simplified summary for frontend update
      const frontendUpdateSummary = {
        totalEvents: filteredEvents.length,
        timestamp: new Date().toISOString()
      };
      
      // Log simplified statistics for the update with timestamp
      const updateTime = new Date();
      logger.critical(`[${updateTime.toISOString()}] Sending ${filteredEvents.length} events to frontend`);
      
      // Emit the all processing completed event with statistics
      scraperEvents.emit(SCRAPER_EVENTS.ALL_PROCESSING_COMPLETED, {
        timestamp: new Date().toISOString(),
        message: 'All scraping and processing completed, frontend can be updated',
        stats: frontendUpdateSummary
      });
    } catch (processingError) {
      console.error('❌ Error processing events:', processingError);
      
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
    const endTime = new Date();
    logger.critical(`[${endTime.toISOString()}] Scraping complete - ${stats.totalEvents} total events mapped from ${successfulScrapers} bookmakers`);
    
    // Emit scraper completed event
    scraperEvents.emit(SCRAPER_EVENTS.COMPLETED, {
      timestamp: endTime.toISOString(),
      message: 'All scrapers completed successfully',
      stats
    });
    
  } catch (error) {
    console.error('❌ Scraper run failed:', error);
    
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
    console.log('🛑 Scrapers stopped');
  }
  
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    console.log('🛑 Cleanup job stopped');
  }
}
