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
    console.log('📊 Calculating tournament average margins by bookmaker...');
    
    // Get all events
    const allEvents = await storage.getEvents();
    
    // Get all bookmakers
    const bookmakers = await storage.getBookmakers();
    const activeBookmakerCodes = bookmakers
      .filter(b => b.active)
      .map(b => b.code);
    
    // Group events by bookmaker and tournament
    // Key format: "bookmakerCode:tournamentName"
    const tournamentGroups = new Map<string, { 
      bookmakerCode: string;
      countryName: string | null | undefined;
      tournamentName: string;
      margins: number[];
      totalMargin: number;
      count: number;
    }>();
    
    let totalGroups = 0;
    
    // Process each event to extract margins for each bookmaker
    for (const event of allEvents) {
      // Skip events without odds data
      if (!event.oddsData) continue;
      
      const tournamentName = event.tournament || event.league;
      if (!tournamentName) continue;
      
      // Process each bookmaker's odds
      for (const bookmakerCode of activeBookmakerCodes) {
        // Type assertion to avoid TypeScript errors
        const eventOddsData = event.oddsData as Record<string, Record<string, any>>;
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
        // For example: "Premier League" exists in multiple countries
        const countryName = event.country || 'Unknown';
        const groupKey = `${bookmakerCode}:${countryName}:${tournamentName}`;
        
        // Create group if it doesn't exist
        if (!tournamentGroups.has(groupKey)) {
          tournamentGroups.set(groupKey, {
            bookmakerCode,
            countryName: countryName,
            tournamentName,
            margins: [],
            totalMargin: 0,
            count: 0
          });
        }
        
        // Add margin to group
        const groupData = tournamentGroups.get(groupKey)!;
        groupData.margins.push(margin);
        groupData.totalMargin += margin;
        groupData.count++;
      }
    }
    
    // Calculate and store average margin for each bookmaker and tournament
    // Use Array.from to convert iterator to array for better compatibility
    const groups = Array.from(tournamentGroups.values());
    
    for (const data of groups) {
      // Only process groups with at least 1 event
      if (data.count < 1) continue;
      
      // Calculate average margin
      const averageMargin = data.totalMargin / data.count;
      
      // Create tournament margin record
      const tournamentMarginData: InsertTournamentMargin = {
        bookmakerCode: data.bookmakerCode,
        countryName: data.countryName || 'Unknown', // Default to 'Unknown' if country is missing
        tournament: data.tournamentName,
        averageMargin: averageMargin.toFixed(2),
        eventCount: data.count
      };
      
      // Store in database
      await db.insert(tournamentMargins).values(tournamentMarginData);
      totalGroups++;
    }
    
    console.log(`✅ Stored average margins for ${totalGroups} bookmaker-tournament combinations`);
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
 * @param days Number of days to keep (default: 30)
 */
export async function cleanupOldTournamentMargins(days: number = 30): Promise<number> {
  try {
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Delete records older than the cutoff date using SQL template
    const { rowCount } = await db.execute(
      sql`DELETE FROM ${tournamentMargins} WHERE ${tournamentMargins.timestamp} < ${cutoffDate.toISOString()}`
    );
    
    const deletedCount = rowCount || 0;
    console.log(`Deleted ${deletedCount} tournament margin records older than ${days} days`);
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old tournament margins:', error);
    throw error;
  }
}