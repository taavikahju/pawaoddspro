import { db } from '../server/db';
import { events, oddsHistory, tournamentMargins } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Script to clean the database - clearing odds history, tournament margin history, and events
 * This is meant to be run manually to start fresh
 */
async function main() {
  try {
    console.log('Starting database cleanup...');
    
    // Clear odds history
    const oddsResult = await db.delete(oddsHistory);
    console.log(`Deleted ${oddsResult.rowCount || 0} odds history records`);
    
    // Clear tournament margins
    const marginsResult = await db.delete(tournamentMargins);
    console.log(`Deleted ${marginsResult.rowCount || 0} tournament margin records`);
    
    // Clear events
    const eventsResult = await db.delete(events);
    console.log(`Deleted ${eventsResult.rowCount || 0} events`);
    
    console.log('Database cleanup complete!');
    console.log('The next scraper run will populate the database with fresh data.');
    
    // Exit the process
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning database:', error);
    process.exit(1);
  }
}

main();