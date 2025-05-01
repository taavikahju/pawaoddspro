import { db } from "../db";
import { tournamentMargins, type InsertTournamentMargin } from "@shared/schema";
import { IStorage } from "../storage";

/**
 * Calculate average margins for each tournament and store in the database
 * @param storage Storage interface to fetch event data
 */
export async function calculateAndStoreTournamentMargins(storage: IStorage): Promise<void> {
  try {
    console.log('📊 Calculating tournament average margins...');
    
    // Get all events
    const allEvents = await storage.getEvents();
    
    // Group events by tournament
    const tournamentGroups = new Map<string, { 
      countryName: string | null | undefined;
      margins: number[];
      totalMargin: number;
      count: number;
    }>();
    
    // Process each event to extract its margin
    for (const event of allEvents) {
      // Skip events without odds data
      if (!event.oddsData) continue;
      
      const tournamentName = event.tournament || event.league;
      if (!tournamentName) continue;
      
      // Calculate event margin based on best odds
      const homeOdds = parseFloat(event.bestOdds?.home?.toString() || '0');
      const drawOdds = parseFloat(event.bestOdds?.draw?.toString() || '0');
      const awayOdds = parseFloat(event.bestOdds?.away?.toString() || '0');
      
      // Skip events without complete best odds
      if (!homeOdds || !drawOdds || !awayOdds) continue;
      
      // Calculate event margin
      const eventMargin = ((1 / homeOdds) + (1 / drawOdds) + (1 / awayOdds) - 1) * 100;
      
      // Add to tournament group
      if (!tournamentGroups.has(tournamentName)) {
        tournamentGroups.set(tournamentName, {
          countryName: event.country,
          margins: [],
          totalMargin: 0,
          count: 0
        });
      }
      
      const tournamentData = tournamentGroups.get(tournamentName)!;
      tournamentData.margins.push(eventMargin);
      tournamentData.totalMargin += eventMargin;
      tournamentData.count++;
    }
    
    // Calculate and store average margin for each tournament
    for (const [tournamentName, data] of tournamentGroups.entries()) {
      // Only process tournaments with sufficient events
      if (data.count < 3) continue;
      
      // Calculate average margin
      const averageMargin = data.totalMargin / data.count;
      
      // Create tournament margin record
      const tournamentMarginData: InsertTournamentMargin = {
        countryName: data.countryName,
        tournamentName,
        averageMargin: averageMargin.toFixed(2),
        eventCount: data.count
      };
      
      // Store in database
      await db.insert(tournamentMargins).values(tournamentMarginData);
    }
    
    console.log(`✅ Stored average margins for ${tournamentGroups.size} tournaments`);
  } catch (error) {
    console.error('Error calculating tournament margins:', error);
  }
}

/**
 * Get tournament margin history
 * @param tournamentName The name of the tournament
 * @returns Array of tournament margin records
 */
export async function getTournamentMarginHistory(tournamentName: string): Promise<any[]> {
  return db.select()
    .from(tournamentMargins)
    .where(tournamentMargins.tournamentName === tournamentName)
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
    
    // Delete records older than the cutoff date
    const result = await db.delete(tournamentMargins)
      .where(tournamentMargins.timestamp < cutoffDate.toISOString());
    
    const deletedCount = result.count || 0;
    console.log(`Deleted ${deletedCount} tournament margin records older than ${days} days`);
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old tournament margins:', error);
    throw error;
  }
}