// Type definitions for bp_gh_live_scraper module
export function scrapeLiveEvents(apiUrl?: string): Promise<any[]>;
export function getMarketAvailabilityStats(): any;
export const runLiveScraper: typeof scrapeLiveEvents;