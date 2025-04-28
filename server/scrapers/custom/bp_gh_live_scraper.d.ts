/**
 * Type declarations for bp_gh_live_scraper.mjs
 */

declare module './bp_gh_live_scraper.mjs' {
  /**
   * Represents a live event with betting data from BetPawa Ghana
   */
  export interface LiveEvent {
    /** Unique identifier for the event */
    eventId: string;
    /** Name of the home team */
    homeTeam: string;
    /** Name of the away team */
    awayTeam: string;
    /** Current game minute (can be null if not available) */
    gameMinute: number | null;
    /** Current score for the home team */
    homeScore: number;
    /** Current score for the away team */
    awayScore: number;
    /** Whether the market is available for betting */
    isAvailable: boolean;
    /** Home win odds */
    homeOdds: number | null;
    /** Draw odds */
    drawOdds: number | null;
    /** Away win odds */
    awayOdds: number | null;
    /** Total number of markets available */
    totalMarketCount: number;
    /** Total number of suspended markets */
    suspendedMarketCount: number;
    /** Reason for market suspension, if any */
    suspensionReason?: string;
    /** ISO timestamp of when the data was collected */
    timestamp: string;
  }

  /**
   * Fetches live events from BetPawa Ghana
   * @returns A promise that resolves to an array of live events
   */
  export function fetchLiveEvents(): Promise<LiveEvent[]>;
  
  /**
   * Main function to scrape live events
   * @returns A promise that resolves to an array of live events
   */
  export function scrapeLiveEvents(): Promise<LiveEvent[]>;
}