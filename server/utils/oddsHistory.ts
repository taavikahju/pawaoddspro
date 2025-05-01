import { db } from "../db";
import { oddsHistory, type InsertOddsHistory } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Calculate margin based on the formula: (1/homeOdds) + (1/drawOdds) + (1/awayOdds) - 1
 * Returns the margin as a percentage with 2 decimal places
 */
export function calculateMargin(
  homeOdds: number | undefined | null, 
  drawOdds: number | undefined | null, 
  awayOdds: number | undefined | null
): string {
  // If any of the odds are missing, return 0
  if (!homeOdds || !drawOdds || !awayOdds) {
    return "0.00";
  }
  
  // Calculate margin as percentage with 2 decimal places
  const margin = ((1 / homeOdds) + (1 / drawOdds) + (1 / awayOdds) - 1) * 100;
  return margin.toFixed(2);
}

/**
 * Save odds history for a particular event and bookmaker
 */
export async function saveOddsHistory(
  eventId: string,
  externalId: string,
  bookmakerCode: string,
  homeOdds: number | undefined | null,
  drawOdds: number | undefined | null,
  awayOdds: number | undefined | null
): Promise<void> {
  // Calculate margin
  const margin = calculateMargin(homeOdds, drawOdds, awayOdds);
  
  // Create odds history entry
  const historyEntry: InsertOddsHistory = {
    eventId,
    externalId,
    bookmakerCode,
    homeOdds: homeOdds?.toString() || null,
    drawOdds: drawOdds?.toString() || null,
    awayOdds: awayOdds?.toString() || null,
    margin
  };
  
  // Save to database
  await db.insert(oddsHistory).values(historyEntry);
}

/**
 * Get odds history for a particular event
 */
export async function getOddsHistory(eventId: string): Promise<any[]> {
  const history = await db.select().from(oddsHistory).where(eq(oddsHistory.eventId, eventId));
  
  // Ensure odds are converted from strings to numbers for margin calculation
  return history.map(entry => ({
    ...entry,
    homeOdds: entry.homeOdds ? parseFloat(entry.homeOdds) : 0,
    drawOdds: entry.drawOdds ? parseFloat(entry.drawOdds) : 0,
    awayOdds: entry.awayOdds ? parseFloat(entry.awayOdds) : 0,
  }));
}

/**
 * Get odds history for a specific bookmaker
 */
export async function getBookmakerOddsHistory(bookmakerCode: string): Promise<any[]> {
  return db.select().from(oddsHistory).where(eq(oddsHistory.bookmakerCode, bookmakerCode));
}

/**
 * Delete odds history older than the specified number of days
 * @param days Number of days to keep (default: 7)
 */
export async function cleanupOldOddsHistory(days: number = 7): Promise<number> {
  try {
    // Calculate the cutoff date (days ago from now)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Get timestamp in database format
    const cutoffTimestamp = cutoffDate.toISOString();
    
    // Delete records older than the cutoff date
    const deleteResult = await db.delete(oddsHistory)
      .where(sql`timestamp < ${cutoffTimestamp}`);
    
    const deletedCount = deleteResult.count || 0;
    console.log(`Deleted ${deletedCount} odds history records older than ${days} days (before ${cutoffTimestamp})`);
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old odds history:', error);
    throw error;
  }
}