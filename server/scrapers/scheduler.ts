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
  console.log('⚙️ Setting up scraper services...');
  
  // Run scrapers immediately on startup
  runAllScrapers(storage)
    .then(() => console.log('✅ Initial scraping completed'))
    .catch(err => console.error('❌ Error during initial scraping:', err));
  
  // Schedule regular scraper runs
  if (scheduledJob) {
    scheduledJob.stop();
  }
  
  scheduledJob = cron.schedule(SCRAPE_SCHEDULE, async () => {
    try {
      // More concise logging
      console.log(`🔄 Scheduled scrape starting [${new Date().toLocaleTimeString()}]`);
      await runAllScrapers(storage);
      // No need for completion message as the scraper itself will log its summary
    } catch (error) {
      console.error('❌ Scheduled scraping failed:', error);
    }
  });
  
  console.log(`📆 Scrapers will run every 15 minutes`);
  
  // Schedule daily cleanup job to remove old history data
  if (cleanupJob) {
    cleanupJob.stop();
  }
  
  cleanupJob = cron.schedule(CLEANUP_SCHEDULE, async () => {
    try {
      console.log(`🧹 Running history cleanup [${new Date().toLocaleTimeString()}]`);
      
      // Clean up odds history
      const { cleanupOldOddsHistory } = await import('../utils/oddsHistory');
      const deletedOddsCount = await cleanupOldOddsHistory(30); // Delete data older than 30 days (1 month)
      console.log(`✅ Odds history cleanup: removed ${deletedOddsCount} records`);
      
      // Clean up tournament margins
      const { cleanupOldTournamentMargins } = await import('../utils/tournamentMargins');
      const deletedMarginsCount = await cleanupOldTournamentMargins(30); // Delete data older than 30 days (1 month)
      console.log(`✅ Tournament margins cleanup: removed ${deletedMarginsCount} records`);
      
      // Log total
      console.log(`✅ Total cleanup: removed ${deletedOddsCount + deletedMarginsCount} records`);
    } catch (error) {
      console.error('❌ History cleanup failed:', error);
    }
  });
  
  console.log(`📆 History cleanup will run daily at midnight`);
}

/**
 * Run all scrapers in sequence
 */
export async function runAllScrapers(storage: IStorage): Promise<void> {
  try {
    console.log('🚀 Starting scraper runs...');
    
    // Emit scraper started event
    scraperEvents.emit(SCRAPER_EVENTS.STARTED, {
      timestamp: new Date().toISOString(),
      message: 'Starting scraper runs'
    });
    
    // Get all bookmakers
    const bookmakers = await storage.getBookmakers();
    const activeBookmakers = bookmakers.filter(bookmaker => bookmaker.active);
    
    console.log(`📊 Processing ${activeBookmakers.length} active bookmakers`);
    
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
    
    console.log(`📊 Scraping in optimized order: ${sortedBookmakers.map(b => b.code).join(', ')}`);
    
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
            // More concise logging
            data = await customScrapers.runCustomScraper(bookmaker.code);
            console.log(`✅ ${bookmaker.name}: ${data?.length || 0} events collected`);
          } catch (customError) {
            console.error(`❌ Error in ${bookmaker.name} scraper:`, customError);
            data = null;
          }
        }
        
        // Only use custom scrapers, no fallbacks to mock scrapers
        if (!data) {
          console.warn(`⚠️ No scraper for ${bookmaker.code}`);
          
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
    console.log(`📊 Total events scraped: ${totalScrapedEvents}`);
    
    console.log(`✅ ${successfulScrapers}/${activeBookmakers.length} scrapers completed successfully`);
    
    console.log(`🔄 Processing and mapping events...`);
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
      
      // Count events by number of bookmakers
      const eventsByBookmakerCount = {
        '1': 0,
        '2': 0,
        '3': 0,
        '4+': 0
      };
      
      allEvents.forEach(event => {
        if (!event.oddsData) return;
        const bookmakerCount = Object.keys(event.oddsData as Record<string, any>).length;
        if (bookmakerCount === 1) eventsByBookmakerCount['1']++;
        else if (bookmakerCount === 2) eventsByBookmakerCount['2']++;
        else if (bookmakerCount === 3) eventsByBookmakerCount['3']++;
        else if (bookmakerCount >= 4) eventsByBookmakerCount['4+']++;
      });
      
      // Create summary for frontend update
      const frontendUpdateSummary = {
        totalEvents: filteredEvents.length,
        eventsByBookmakerCount: eventsByBookmakerCount,
        timestamp: new Date().toISOString()
      };
      
      // Log statistics for the update
      console.log('🚀 FRONTEND UPDATE SUMMARY:');
      console.log(`📊 Total events: ${filteredEvents.length} (filtered to have at least 2 bookmakers)`);
      console.log('📊 Event distribution by bookmaker count:');
      console.log(`  - Events with 1 bookmaker: ${eventsByBookmakerCount['1']}`);
      console.log(`  - Events with 2 bookmakers: ${eventsByBookmakerCount['2']}`);
      console.log(`  - Events with 3 bookmakers: ${eventsByBookmakerCount['3']}`);
      console.log(`  - Events with 4+ bookmakers: ${eventsByBookmakerCount['4+']}`);
      
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
    console.log(`📊 Scraping complete: ${stats.totalEvents} total events`);
    
    // Emit scraper completed event
    scraperEvents.emit(SCRAPER_EVENTS.COMPLETED, {
      timestamp: new Date().toISOString(),
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
