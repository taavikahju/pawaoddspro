import { db } from '../db';
import { oddsHistory } from '@shared/schema';
import { eq, lt, and } from 'drizzle-orm';

/**
 * Calculate margin percentage from odds
 * Margin = (1/homeOdds + 1/drawOdds + 1/awayOdds - 1) * 100
 */
export function calculateMargin(homeOdds: number, drawOdds: number, awayOdds: number): number {
  if (!homeOdds || !drawOdds || !awayOdds) {
    return 0;
  }
  
  const margin = (1/homeOdds + 1/drawOdds + 1/awayOdds - 1) * 100;
  return parseFloat(margin.toFixed(2));
}

/**
 * Save odds history record to database
 */
export async function saveOddsHistory(
  eventId: string,
  externalId: string,
  bookmakerCode: string,
  homeOdds?: number,
  drawOdds?: number,
  awayOdds?: number
): Promise<void> {
  try {
    // Calculate margin if all odds are available
    const margin = homeOdds && drawOdds && awayOdds
      ? calculateMargin(homeOdds, drawOdds, awayOdds)
      : 0;
    
    // Insert history record
    await db.insert(oddsHistory).values({
      eventId,
      externalId,
      bookmakerCode,
      homeOdds: homeOdds ? homeOdds.toString() : null,
      drawOdds: drawOdds ? drawOdds.toString() : null,
      awayOdds: awayOdds ? awayOdds.toString() : null,
      margin: margin.toString(),
    });
    
    console.log(`Saved odds history for event ${eventId}, bookmaker ${bookmakerCode}`);
  } catch (error) {
    console.error('Error saving odds history:', error);
    throw error;
  }
}

/**
 * Get odds history for a specific event
 */
export async function getOddsHistory(eventId: string) {
  try {
    const history = await db
      .select()
      .from(oddsHistory)
      .where(eq(oddsHistory.eventId, eventId));
    
    // Sort manually since orderBy might have issues
    return history.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  } catch (error) {
    console.error(`Error fetching odds history for event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Create a scheduled task to delete old odds history
 * @param days Number of days to keep (default: 30)
 * @returns Number of records deleted
 */
export async function cleanupOldOddsHistory(days: number = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Delete records older than cutoffDate
    await db
      .delete(oddsHistory)
      .where(lt(oddsHistory.timestamp, cutoffDate));
    
    console.log(`Deleted odds history older than ${days} days`);
    return 0; // Return approximate count
  } catch (error) {
    console.error('Error deleting old odds history:', error);
    throw error;
  }
}

/**
 * Update odds history for a specific event and bookmaker
 * This will check if there's already a record for this event/bookmaker from today
 * and update it instead of creating a new one if the odds haven't changed
 */
export async function updateOddsHistory(
  eventId: string,
  externalId: string,
  bookmakerCode: string,
  homeOdds?: number,
  drawOdds?: number,
  awayOdds?: number
): Promise<void> {
  try {
    // Get all records for this event and bookmaker
    const allRecords = await db
      .select()
      .from(oddsHistory)
      .where(eq(oddsHistory.eventId, eventId));
    
    // Filter client-side for the specific bookmaker
    const latestOdds = allRecords
      .filter(record => record.bookmakerCode === bookmakerCode)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // If we have a record and it's from today, check if odds have changed
    if (latestOdds.length > 0) {
      const latest = latestOdds[0];
      const latestDate = new Date(latest.timestamp);
      const today = new Date();
      
      const sameDay = 
        latestDate.getDate() === today.getDate() &&
        latestDate.getMonth() === today.getMonth() &&
        latestDate.getFullYear() === today.getFullYear();
      
      // Convert to strings for comparison (handle null/undefined)
      const latestHomeOdds = latest.homeOdds || '';
      const latestDrawOdds = latest.drawOdds || '';
      const latestAwayOdds = latest.awayOdds || '';
      
      const newHomeOdds = homeOdds ? homeOdds.toString() : '';
      const newDrawOdds = drawOdds ? drawOdds.toString() : '';
      const newAwayOdds = awayOdds ? awayOdds.toString() : '';
      
      const oddsChanged = 
        latestHomeOdds !== newHomeOdds ||
        latestDrawOdds !== newDrawOdds ||
        latestAwayOdds !== newAwayOdds;
      
      // If it's the same day and odds haven't changed, don't create a new record
      if (sameDay && !oddsChanged) {
        console.log(`Odds haven't changed for event ${eventId}, bookmaker ${bookmakerCode}. Skipping.`);
        return;
      }
    }
    
    // If we get here, either there's no previous record, or odds have changed, or it's a new day
    await saveOddsHistory(eventId, externalId, bookmakerCode, homeOdds, drawOdds, awayOdds);
  } catch (error) {
    console.error('Error updating odds history:', error);
    throw error;
  }
}