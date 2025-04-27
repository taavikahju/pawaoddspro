/**
 * Utility functions for scrapers to ensure consistent data formatting
 */

/**
 * Clean up and normalize scraped event data
 * This ensures consistent field naming and proper data types across different scrapers
 */
export function cleanupScraperData(event: any, bookmakerCode: string): any {
  // Ensure we have a valid event object
  if (!event) return null;

  // Make sure we have an odds object in the expected format
  if (!event.odds && event.home_odds && event.draw_odds && event.away_odds) {
    event.odds = {
      home: parseFloat(event.home_odds),
      draw: parseFloat(event.draw_odds),
      away: parseFloat(event.away_odds)
    };
  }

  // If we still don't have an odds object, log error and try other formats
  if (!event.odds && event.homeOdds && event.drawOdds && event.awayOdds) {
    event.odds = {
      home: parseFloat(event.homeOdds),
      draw: parseFloat(event.drawOdds),
      away: parseFloat(event.awayOdds)
    };
  }

  // SportyBet specific handling - sometimes the odds are flat in the object
  if (!event.odds && event["1"] && event.X && event["2"]) {
    event.odds = {
      home: parseFloat(event["1"]),
      draw: parseFloat(event.X),
      away: parseFloat(event["2"])
    };
  }

  // Make sure the bookmaker code is properly set
  if (!event.bookmakerCode) {
    event.bookmakerCode = bookmakerCode;
  }

  // Always log if we have no odds at all
  if (!event.odds) {
    console.error(`⚠️ Event data has no odds: ${JSON.stringify(event)}`);
  }

  return event;
}

/**
 * Process a batch of events to ensure they all have consistent data
 */
export function processScrapedEvents(events: any[], bookmakerCode: string): any[] {
  if (!events || !Array.isArray(events)) {
    console.error(`⚠️ Invalid events data from ${bookmakerCode}: ${JSON.stringify(events)}`);
    return [];
  }

  return events
    .filter(event => event !== null && event !== undefined)
    .map(event => cleanupScraperData(event, bookmakerCode));
}