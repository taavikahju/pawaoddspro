import { db } from "../db";
import { tournamentMargins, type InsertTournamentMargin } from "@shared/schema";
import { IStorage } from "../storage";
import { eq, sql } from "drizzle-orm";

/**
 * Calculate margin based on odds
 */
function calculateMargin(homeOdds: number, drawOdds: number, awayOdds: number): number {
  // Return as a decimal (0.0364) instead of percentage (3.64%)
  return (1 / homeOdds) + (1 / drawOdds) + (1 / awayOdds) - 1;
}

/**
 * Calculate average margins for each tournament and store in the database
 * @param storage Storage interface to fetch event data
 */
export async function calculateAndStoreTournamentMargins(storage: IStorage): Promise<void> {
  try {
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] Calculating tournament average margins by bookmaker...`);
    
    // Get all events - use parallel fetching for speed
    const [allEvents, bookmakers] = await Promise.all([
      storage.getEvents(),
      storage.getBookmakers()
    ]);
    
    // Get active bookmaker codes
    const activeBookmakerCodes = bookmakers
      .filter(b => b.active)
      .map(b => b.code);
    
    // Use a more optimized approach with a standard object for faster lookups
    const tournamentGroupsMap: Record<string, { 
      bookmakerCode: string;
      countryName: string;
      tournamentName: string;
      totalMargin: number;
      count: number;
    }> = {};
    
    let totalGroups = 0;
    
    // Process events in batches for better performance
    const BATCH_SIZE = 1000;
    const eventBatches = [];
    for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
      eventBatches.push(allEvents.slice(i, i + BATCH_SIZE));
    }
    
    // Process each event batch
    for (const eventBatch of eventBatches) {
      // Process each event to extract margins for each bookmaker
      for (const event of eventBatch) {
        // Skip events without odds data
        if (!event.oddsData) continue;
        
        const tournamentName = event.tournament || event.league;
        if (!tournamentName) continue;
        
        // Type assertion to avoid TypeScript errors
        const eventOddsData = event.oddsData as Record<string, Record<string, any>>;
        
        // Process each bookmaker's odds more efficiently
        for (const bookmakerCode of activeBookmakerCodes) {
          const bookmakerOdds = eventOddsData[bookmakerCode];
          if (!bookmakerOdds) continue;
          
          const homeOdds = parseFloat(bookmakerOdds.home?.toString() || '0');
          const drawOdds = parseFloat(bookmakerOdds.draw?.toString() || '0');
          const awayOdds = parseFloat(bookmakerOdds.away?.toString() || '0');
          
          // Skip if any odds are missing
          if (!homeOdds || !drawOdds || !awayOdds) continue;
          
          // Calculate margin for this bookmaker's odds
          const margin = calculateMargin(homeOdds, drawOdds, awayOdds);
          
          // Include country in group key to separate leagues with same name in different countries
          const countryName = event.country || 'Unknown';
          const groupKey = `${bookmakerCode}:${countryName}:${tournamentName}`;
          
          // Create group if it doesn't exist
          if (!tournamentGroupsMap[groupKey]) {
            tournamentGroupsMap[groupKey] = {
              bookmakerCode,
              countryName,
              tournamentName,
              totalMargin: 0,
              count: 0
            };
          }
          
          // Add margin to group - don't store individual margins to save memory
          const groupData = tournamentGroupsMap[groupKey];
          groupData.totalMargin += margin;
          groupData.count++;
        }
      }
    }
    
    // Prepare batch insert of tournament margins
    const batchInsertValues: InsertTournamentMargin[] = [];
    
    // Process each group and prepare for batch insert
    for (const groupKey in tournamentGroupsMap) {
      const data = tournamentGroupsMap[groupKey];
      
      // Only process groups with at least 1 event
      if (data.count < 1) continue;
      
      // Calculate average margin
      const averageMargin = data.totalMargin / data.count;
      
      // Create tournament margin record
      batchInsertValues.push({
        bookmakerCode: data.bookmakerCode,
        countryName: data.countryName || 'Unknown',
        tournament: data.tournamentName,
        averageMargin: averageMargin.toFixed(6), // Store with 6 decimal places for more precision
        eventCount: data.count
      });
      
      totalGroups++;
    }
    
    // Perform a single batch insert for better performance
    if (batchInsertValues.length > 0) {
      await db.insert(tournamentMargins).values(batchInsertValues);
    }
    
    const endTime = new Date();
    console.log(`[${endTime.toISOString()}] Stored average margins for ${totalGroups} bookmaker-tournament combinations`);
    
    // Run cleanup of old data (we'll keep the last 5 days of data)
    await cleanupOldTournamentMargins(5);
  } catch (error) {
    console.error('Error calculating tournament margins:', error);
  }
}

/**
 * Get tournament margin history for a specific bookmaker
 * @param tournamentName The name of the tournament
 * @param bookmakerCode The bookmaker code
 * @param countryName Optional country name to filter by
 * @returns Array of tournament margin records
 */
export async function getTournamentMarginHistory(
  tournamentName: string,
  bookmakerCode?: string,
  countryName?: string
): Promise<any[]> {
  // Build the SQL condition based on provided parameters
  let condition = sql`${tournamentMargins.tournament} = ${tournamentName}`;
  
  // Add bookmaker filter if provided
  if (bookmakerCode) {
    condition = sql`${condition} AND ${tournamentMargins.bookmakerCode} = ${bookmakerCode}`;
  }
  
  // Add country filter if provided
  if (countryName) {
    condition = sql`${condition} AND ${tournamentMargins.countryName} = ${countryName}`;
  }
  
  // Execute the query with the combined condition
  return db
    .select()
    .from(tournamentMargins)
    .where(condition)
    .orderBy(tournamentMargins.timestamp);
}

/**
 * Clean up old tournament margin history records
 * @param days Number of days to keep (default: 5)
 */
export async function cleanupOldTournamentMargins(days: number = 5): Promise<number> {
  try {
    const cleanupStartTime = new Date();
    console.log(`[${cleanupStartTime.toISOString()}] Starting cleanup of tournament margin records older than ${days} days`);
    
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Delete records older than the cutoff date using SQL template
    const { rowCount } = await db.execute(
      sql`DELETE FROM ${tournamentMargins} WHERE ${tournamentMargins.timestamp} < ${cutoffDate.toISOString()}`
    );
    
    const deletedCount = rowCount || 0;
    const cleanupEndTime = new Date();
    console.log(`[${cleanupEndTime.toISOString()}] Deleted ${deletedCount} tournament margin records older than ${days} days`);
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old tournament margins:', error);
    throw error;
  }
}