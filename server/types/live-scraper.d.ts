declare module './scrapers/custom/live_scraper_scheduler' {
  import { EventEmitter } from 'events';
  
  export const LIVE_SCRAPER_EVENTS: {
    STARTED: string;
    COMPLETED: string;
    ERROR: string;
    MARKET_CHANGE: string;
  };
  
  export const liveScraperEvents: EventEmitter;
  
  export function startLiveScraper(apiUrl: string): void;
  export function stopLiveScraper(): void;
  export function getLiveScraperStatus(): {
    isRunning: boolean;
    marketStats: {
      totalEvents: number;
      availableMarkets: number;
      suspendedMarkets: number;
      eventDetails: Array<{
        id: string;
        name: string;
        country: string;
        tournament: string;
        marketAvailability: string;
        currentlyAvailable: boolean;
        recordCount: number;
      }>;
    };
  };
}

declare module './scrapers/custom/bp_gh_live_scraper' {
  export function scrapeLiveEvents(apiUrl: string): Promise<any[]>;
  export function getMarketAvailabilityStats(): {
    totalEvents: number;
    availableMarkets: number;
    suspendedMarkets: number;
    eventDetails: Array<{
      id: string;
      name: string;
      country: string;
      tournament: string;
      marketAvailability: string;
      currentlyAvailable: boolean;
      recordCount: number;
      uptimePercentage?: number;
      homeScore?: number;
      awayScore?: number;
      gameMinute?: string;
    }>;
  };
}