import { db } from "../db";
import { oddsHistory, type InsertOddsHistory } from "@shared/schema";
import { eq } from "drizzle-orm";

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
  return db.select().from(oddsHistory).where(eq(oddsHistory.eventId, eventId));
}

/**
 * Get odds history for a specific bookmaker
 */
export async function getBookmakerOddsHistory(bookmakerCode: string): Promise<any[]> {
  return db.select().from(oddsHistory).where(eq(oddsHistory.bookmakerCode, bookmakerCode));
}