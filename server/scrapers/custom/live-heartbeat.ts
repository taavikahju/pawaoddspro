import EventEmitter from 'events';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { IStorage } from '../../storage';
import { URL } from 'url';

// Debug utility function to dump API response
function debugDumpApiResponse(event: any, source: string) {
  try {
    console.log(`[DEBUG-${source}] Event ID: ${event.id}`);
    console.log(`[DEBUG-${source}] Event Name: ${event.name}`);
    
    // Log different paths where team information might be
    if (event.name) {
      console.log(`[DEBUG-${source}] Found event.name: ${event.name}`);
    }
    
    if (event.competitors) {
      console.log(`[DEBUG-${source}] Found event.competitors:`, 
        JSON.stringify(event.competitors.map((c: any) => c.name || c))
      );
    }
    
    if (event.homeTeam || event.awayTeam) {
      console.log(`[DEBUG-${source}] Found homeTeam/awayTeam:`, 
        JSON.stringify({home: event.homeTeam, away: event.awayTeam})
      );
    }
    
    // Log any teams information in results
    if (event.results && event.results.teams) {
      console.log(`[DEBUG-${source}] Found event.results.teams:`, 
        JSON.stringify(event.results.teams)
      );
    }
    
    // Log any display/scoreboard info that might have team data
    if (event.scoreboard) {
      console.log(`[DEBUG-${source}] Found event.scoreboard:`, 
        JSON.stringify(event.scoreboard)
      );
    }
    
    if (event.results && event.results.display) {
      console.log(`[DEBUG-${source}] Found event.results.display:`, 
        JSON.stringify(event.results.display)
      );
    }
  } catch (error) {
    console.error(`Error in debugDumpApiResponse for ${source}:`, error);
  }
}

// Event emitter for live heartbeat updates
export const heartbeatEvents = new EventEmitter();

// Event types
export const HEARTBEAT_EVENTS = {
  STATUS_UPDATED: 'heartbeat_status_updated',
  MARKET_CHANGED: 'market_changed',
  HEARTBEAT: 'heartbeat'
};

// Interface for heartbeat events
interface HeartbeatEvent {
  id: string;
  name: string;
  country: string;
  tournament: string;
  isInPlay: boolean;
  startTime: string;
  currentlyAvailable: boolean;
  marketAvailability: string;
  recordCount: number;
  gameMinute?: string;
  widgetId?: string;
  homeTeam?: string;
  awayTeam?: string;
}

// Interface for market history tracking
interface MarketHistory {
  eventId: string;
  timestamps: {
    timestamp: number;
    isAvailable: boolean;
  }[];
}

// Interface for the heartbeat state
interface HeartbeatState {
  isRunning: boolean;
  events: HeartbeatEvent[];
  countries: string[];
  tournaments: Record<string, string[]>;
  lastUpdate: number;
}

// Market history for tracking availability over time
let marketHistories: MarketHistory[] = [];

// Global heartbeat state
let heartbeatState: HeartbeatState = {
  isRunning: false,
  events: [],
  countries: [],
  tournaments: {},
  lastUpdate: 0
};

// Ensure data directory exists
async function ensureDataDirectory() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    return dataDir;
  } catch (error) {
    console.error('Error creating data directory:', error);
    throw error;
  }
}

// Start the heartbeat tracker
export function startHeartbeatTracker(url: string, storage: IStorage): void {
  if (heartbeatState.isRunning) {
    console.log('Heartbeat tracker is already running');
    return;
  }

  console.log('Starting heartbeat tracker');
  heartbeatState.isRunning = true;
  runHeartbeatTracker(url, storage).catch(error => {
    console.error('Error in heartbeat tracker:', error);
    heartbeatState.isRunning = false;
  });
}

// Stop the heartbeat tracker
export function stopHeartbeatTracker(): void {
  console.log('Stopping heartbeat tracker');
  heartbeatState.isRunning = false;
}

// Main heartbeat tracker function
async function runHeartbeatTracker(url: string, storage: IStorage): Promise<void> {
  try {
    await loadHistoryData();
  } catch (error) {
    console.error('Error loading history data:', error);
    // Continue running even if we can't load history data
  }

  let lastSuccessfulScrape = 0;
  
  // Loop until stopped
  while (heartbeatState.isRunning) {
    try {
      console.log('Running heartbeat tracker cycle');
      
      // Fetch real events from the API
      const events = await scrapeEvents(url);
      
      // Process events
      await processEvents(events);
      
      lastSuccessfulScrape = Date.now();
      heartbeatState.lastUpdate = lastSuccessfulScrape;
      
      // Save history data periodically
      try {
        await saveHistoryData();
      } catch (error) {
        console.error('Error saving history data:', error);
        // Continue running even if we can't save history data
      }
      
      // Clean up old data
      cleanupOldData();
      
      // Emit event for UI updates
      heartbeatEvents.emit(HEARTBEAT_EVENTS.STATUS_UPDATED, heartbeatState);
      
      // Wait 10 seconds before next cycle
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
      console.error('Error in heartbeat cycle:', error);
      
      // If we haven't had a successful scrape in 5 minutes, reset events
      if (Date.now() - lastSuccessfulScrape > 5 * 60 * 1000) {
        console.log('No successful scrape in 5 minutes, resetting events');
        heartbeatState.events = [];
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
}

// Generate mock events for demo mode
function generateMockEvents(): any[] {
  console.log('Generating mock events for demo');
  
  // Demo events with different teams and properties
  const events = [
    {
      id: '26987202',
      name: 'Rahmatganj MFS vs Bashundhara Kings',
      category: { name: 'Bangladesh' },
      competition: { name: 'Premier League' },
      startTime: new Date().toISOString(),
      scoreboard: {
        display: {
          minute: String(Math.floor(Date.now() / 60000) % 90 + 1)
        }
      },
      markets: [
        {
          typeId: '3743',
          name: '1X2',
          suspended: (Math.floor(Date.now() / 1000) % 45) >= 30,
          prices: [
            { typeId: '3744', name: '1', suspended: false, price: 3.5 },
            { typeId: '3745', name: 'X', suspended: false, price: 3.4 },
            { typeId: '3746', name: '2', suspended: false, price: 1.9 }
          ]
        }
      ]
    },
    {
      id: '26968026',
      name: 'Abahani Limited Dhaka vs Mohammedan SC Dhaka',
      category: { name: 'Bangladesh' },
      competition: { name: 'Premier League' },
      startTime: new Date().toISOString(),
      scoreboard: {
        display: {
          minute: Math.floor(Date.now() / 1000) % 60 >= 20 && Math.floor(Date.now() / 1000) % 60 < 30 
            ? 'HT' 
            : String(Math.floor(Date.now() / 120000) % 90 + 1)
        }
      },
      markets: [
        {
          typeId: '3743',
          name: '1X2',
          suspended: (Math.floor(Date.now() / 1000) % 60) >= 50,
          prices: [
            { typeId: '3744', name: '1', suspended: false, price: 2.1 },
            { typeId: '3745', name: 'X', suspended: false, price: 3.2 },
            { typeId: '3746', name: '2', suspended: false, price: 3.0 }
          ]
        }
      ]
    },
    {
      id: '27008584',
      name: 'JS Saoura U21 vs USM Alger U21',
      category: { name: 'Algeria' },
      competition: { name: 'U21 League' },
      startTime: new Date().toISOString(),
      scoreboard: {
        display: {
          minute: '46'
        }
      },
      markets: [
        {
          typeId: '3743',
          name: '1X2',
          suspended: (Math.floor(Date.now() / 1000) % 20) >= 10,
          prices: [
            { typeId: '3744', name: '1', suspended: false, price: 1.5 },
            { typeId: '3745', name: 'X', suspended: false, price: 4.2 },
            { typeId: '3746', name: '2', suspended: false, price: 5.5 }
          ]
        }
      ]
    },
    {
      id: '25332692',
      name: 'Melbourne City FC vs Adelaide United FC',
      category: { name: 'Australia' },
      competition: { name: 'A-League' },
      startTime: new Date().toISOString(),
      scoreboard: {
        display: {
          minute: '5'
        }
      },
      markets: [
        {
          typeId: '3743',
          name: '1X2',
          suspended: (Math.floor(Date.now() / 1000) % 60) >= 15,
          prices: [
            { typeId: '3744', name: '1', suspended: false, price: 1.8 },
            { typeId: '3745', name: 'X', suspended: false, price: 3.5 },
            { typeId: '3746', name: '2', suspended: false, price: 4.0 }
          ]
        }
      ]
    },
    {
      id: '26967985',
      name: 'NWS Spirit FC U20 vs St George FC U20',
      category: { name: 'Australia' },
      competition: { name: 'NSW NPL Youth' },
      startTime: new Date().toISOString(),
      scoreboard: {
        display: {
          minute: '10'
        }
      },
      markets: [
        {
          typeId: '3743',
          name: '1X2',
          suspended: ((Math.floor(Date.now() / 1000) % 100) >= 40) && ((Math.floor(Date.now() / 1000) % 17) !== 0),
          prices: [
            { typeId: '3744', name: '1', suspended: false, price: 1.6 },
            { typeId: '3745', name: 'X', suspended: false, price: 3.8 },
            { typeId: '3746', name: '2', suspended: false, price: 4.5 }
          ]
        }
      ]
    }
  ];
  
  console.log(`Generated ${events.length} mock events`);
  return events;
}

// Helper function to build API URLs
function buildApiUrl(host: string, path: string, params: Record<string, any> = {}): string {
  const url = new URL(path, host);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value.toString());
  });
  return url.toString();
}

// Scrape events from API
async function scrapeEvents(apiUrl: string): Promise<any[]> {
  console.log(`Scraping events from ${apiUrl}`);
  
  try {
    // For BetPawa API, we need specific headers and a specific query format
    // Using the same configuration from the working scraper
    const domain = 'www.betpawa.com.gh';
    const brand = 'ghana';
    
    // Try with the provided URL first
    let url = apiUrl;
    let headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };
    
    // Check if this is the BetPawa domain
    const isBetPawa = apiUrl.includes('betpawa');
    
    if (isBetPawa) {
      console.log('Using BetPawa-specific configuration');
      
      // Construct a query for live events with football (category 2)
      const take = 20;
      const skip = 0;
      const encodedQuery = `%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A${skip}%2C%22take%22%3A${take}%7D%5D%7D`;
      
      // Override with the URL that's known to work
      url = `https://${domain}/api/sportsbook/v2/events/lists/by-queries?q=${encodedQuery}`;
      
      // Create the headers from the working implementation
      headers = {
        "accept": "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "baggage": "sentry-environment=production,sentry-release=1.203.58",
        "devicetype": "web",
        "if-modified-since": new Date().toUTCString(),
        "priority": "u=1, i",
        "referer": `https://${domain}/events?marketId=1X2&categoryId=2`,
        "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sentry-trace": "69dc4eced394402e8b4842078bf03b47-982bacd1c87283b4-0",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "vuejs": "true",
        "x-pawa-brand": `betpawa-${brand}`,
        "x-pawa-language": "en"
      };
      
      // Use the cookies from the working implementation
      const cookies = {
        "_ga": "GA1.1.459857438.1713161475",
        "_ga_608WPEPCC3": "GS1.1.1731480684.7.0.1731480684.0.0.0",
        "aff_cookie": "F60",
        "_gcl_au": "1.1.1725251410.1738666716",
        "PHPSESSID": "b0694dabe05179bc223abcdf8f7bf83e",
        "tracingId": "0f5927de-e30d-4228-b29c-c92210017a62",
        "x-pawa-token": "b4c6eda2ae319f4b-8a3075ba3c9d9984"
      };
      
      // Convert cookies to string format
      const cookieString = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      // Add cookies to headers
      headers['cookie'] = cookieString;
    }
    
    console.log(`Scraping using URL: ${url}`);
    
    console.log(`Making request to: ${url}`);
    const response = await axios.get(url, {
      headers,
      timeout: 30000
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const data = response.data;
    
    // BetPawa API returns different structures based on the endpoint
    if (isBetPawa && data.events) {
      // Handle BetPawa v2 API response format
      console.log(`Scraped ${data.events.length} events from BetPawa API`);
      return data.events;
    } else if (isBetPawa && data.results && Array.isArray(data.results)) {
      // Handle BetPawa v1 API response format
      console.log(`Scraped ${data.results.length} events from BetPawa API`);
      return data.results;
    } else if (isBetPawa && data.queries && Array.isArray(data.queries)) {
      // Handle the queries format (lists/by-queries endpoint)
      const allEvents = [];
      for (const query of data.queries) {
        if (query.events && Array.isArray(query.events)) {
          allEvents.push(...query.events);
        }
      }
      console.log(`Scraped ${allEvents.length} events from BetPawa API (queries format)`);
      return allEvents;
    } else if (Array.isArray(data)) {
      // Handle standard array response
      console.log(`Scraped ${data.length} events`);
      return data;
    } else {
      throw new Error('Invalid data format: expected array or known BetPawa structure');
    }
  } catch (error) {
    console.error('Error scraping events:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    
    // Return empty array on error
    return [];
  }
}

// Process scraped events and update state
async function processEvents(events: any[]): Promise<void> {
  if (!events || events.length === 0) {
    console.log("No events to process - returning early");
    return;
  }

  console.log(`Processing ${events.length} live events for heartbeat tracking...`);
  
  // For each real event, log its structure and market status
  for (const event of events) {
    console.log(`LIVE EVENT: ID=${event.id}, Name=${event.name}, Market status=${event.markets?.[0]?.suspended ? "SUSPENDED" : "ACTIVE"}`);
    
    // Debug: log the scoreboard and market info for each event
    if (event.scoreboard?.display) {
      console.log(`    Minute: ${event.scoreboard.display.minute}`);
    }
    
    if (event.markets && event.markets.length > 0) {
      const market = event.markets[0];
      console.log(`    Market: typeId=${market.typeId || market.type}, suspended=${market.suspended}, prices=${market.prices?.length || 0}`);
      
      // Print price status (only first 2 prices to reduce log noise)
      if (market.prices && market.prices.length > 0) {
        market.prices.slice(0, 2).forEach((price: any, index: number) => {
          console.log(`      Price ${index + 1}: name=${price.name}, suspended=${price.suspended}, value=${price.price}`);
        });
        if (market.prices.length > 2) {
          console.log(`      ... and ${market.prices.length - 2} more prices`);
        }
      }
    }
  }

  // Convert real events to HeartbeatEvents
  const processedEvents: HeartbeatEvent[] = [];
  
  // Process each live event
  for (const event of events) {
    try {
      // Debug: Print the raw event structure to better understand the API's format
      console.log("Processing event:", JSON.stringify(event, null, 2).substring(0, 500) + "...");

      // Extract event ID - BetPawa API may use different structures
      const eventId = event.id?.toString() || 
                     event.eventId?.toString() || 
                     event.fixture?.id?.toString();
                     
      if (!eventId) {
        console.log("Skipping event with no ID");
        continue;
      }
      
      // Extract event name - BetPawa API may have teams in different properties
      let eventName = "";
      let homeTeam = "";
      let awayTeam = "";
      
      // Try to get home and away team names from various possible properties
      if (event.fixture?.homeName && event.fixture?.awayName) {
        homeTeam = event.fixture.homeName;
        awayTeam = event.fixture.awayName;
        eventName = `${homeTeam} vs ${awayTeam}`;
      } else if (event.homeTeam && event.awayTeam) {
        homeTeam = event.homeTeam;
        awayTeam = event.awayTeam;
        eventName = `${homeTeam} vs ${awayTeam}`;
      } else if (event.name && event.name.includes(" vs ")) {
        eventName = event.name;
        const parts = eventName.split(" vs ");
        homeTeam = parts[0].trim();
        awayTeam = parts[1].trim();
      } else if (event.fixture?.name) {
        eventName = event.fixture.name;
        if (eventName.includes(" vs ")) {
          const parts = eventName.split(" vs ");
          homeTeam = parts[0].trim();
          awayTeam = parts[1].trim();
        }
      } else {
        // Fallback to event name or default
        eventName = event.name || "Unknown Event";
      }
      
      // Extract location information
      const country = event.category?.name || 
                     event.tournament?.category?.name || 
                     event.fixture?.tournament?.category?.name || 
                     event.region?.name || 
                     "Unknown";
                     
      const tournament = event.competition?.name || 
                        event.tournament?.name || 
                        event.fixture?.tournament?.name || 
                        "Unknown";
      
      // Check market availability - BetPawa API has different structures for markets
      let isMarketAvailable = false;
      
      // Check different possible market structures
      if (event.markets && event.markets.length > 0) {
        // Classic market structure
        isMarketAvailable = !event.markets[0].suspended;
      } else if (event.fixture?.markets && event.fixture.markets.length > 0) {
        // Alternative market structure
        isMarketAvailable = !event.fixture.markets[0].suspended;
      } else if (event.bettingStatus === "AVAILABLE") {
        // Direct betting status property
        isMarketAvailable = true;
      } else if (event.status === "ACTIVE" || event.status === "OPEN") {
        // Status property
        isMarketAvailable = true;
      }
      
      // Get the game minute from the event data - check multiple possible structures
      const gameMinute = event.scoreboard?.display?.minute || 
                       event.fixture?.timer?.minute?.toString() || 
                       event.minute?.toString() || 
                       event.time?.toString() || 
                       event.matchTime?.toString() || 
                       "1";
      
      // Create a HeartbeatEvent from the real event data
      const heartbeatEvent: HeartbeatEvent = {
        id: eventId,
        name: eventName,
        country: country,
        tournament: tournament,
        isInPlay: true,
        startTime: event.startTime || event.fixture?.startTime || new Date().toISOString(),
        currentlyAvailable: isMarketAvailable,
        marketAvailability: isMarketAvailable ? "ACTIVE" : "SUSPENDED",
        recordCount: 1,
        gameMinute: gameMinute,
        widgetId: event.widget?.id || event.id?.toString() || "",
        homeTeam: homeTeam,
        awayTeam: awayTeam
      };
      
      processedEvents.push(heartbeatEvent);
      console.log(`Added live event to processed events: ${eventId} - ${eventName}`);
      
      // Update market history for each event as we go
      updateMarketHistory(heartbeatEvent);
    } catch (error) {
      console.error(`Error processing demo event:`, error);
    }
  }
  
  // Update the heartbeat state with the processed events
  heartbeatState.events = processedEvents;

  // Collect unique countries and tournaments for filtering
  const countries = new Set<string>();
  const tournaments: Record<string, string[]> = {};

  // Extract countries and tournaments from processed events
  for (const event of processedEvents) {
    if (event.country) {
      countries.add(event.country);
      
      if (!tournaments[event.country]) {
        tournaments[event.country] = [];
      }
      
      if (event.tournament && !tournaments[event.country].includes(event.tournament)) {
        tournaments[event.country].push(event.tournament);
      }
    }
  }

  // Update the countries and tournaments in the heartbeat state
  heartbeatState.countries = Array.from(countries);
  heartbeatState.tournaments = tournaments;
}

// Update market history for an event
function updateMarketHistory(event: HeartbeatEvent): void {
  const now = Date.now();
  
  // Find existing history or create new one
  let history = marketHistories.find(h => h.eventId === event.id);
  
  if (!history) {
    history = {
      eventId: event.id,
      timestamps: []
    };
    marketHistories.push(history);
  }
  
  // Add current timestamp
  history.timestamps.push({
    timestamp: now,
    isAvailable: event.currentlyAvailable
  });
  
  // Keep only the last 24 hours of history
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  history.timestamps = history.timestamps.filter(t => t.timestamp >= oneDayAgo);
}

// Get market history for an event
export function getAllEventHistories(): any[] {
  // Only return historical events that are not in the current active events
  const historicalEvents: any[] = [];
  
  // For testing purposes, include some current events as historical
  // In a production environment, we would only include actually completed events
  marketHistories.forEach(history => {
    // For testing, consider events with ID ending in even numbers as "historical"
    // In production, this would be based on game completion status
    const forceHistorical = parseInt(history.eventId) % 2 === 0;
    
    // Only include events with enough data (at least 20 data points)
    if (history.timestamps.length >= 20 && (forceHistorical || history.eventId.includes('vs'))) {
      // This is a historical event not in current active set
      // Find the team names if available in the timestamps data
      let homeTeam = '';
      let awayTeam = '';
      
      // Try to extract team names from event data if possible
      const eventId = history.eventId;
      if (eventId.includes('vs')) {
        const nameParts = eventId.split('vs');
        homeTeam = nameParts[0].trim();
        awayTeam = nameParts[1].trim();
      }
      
      // Create a proper name from the event ID
      let eventName = history.eventId;
      if (eventId.includes('-')) {
        eventName = eventId.replace(/-/g, ' vs ');
      }
      
      // Get the first timestamp to use as the start time
      const firstTimestamp = history.timestamps[0]?.timestamp || Date.now();
      const lastTimestamp = history.timestamps[history.timestamps.length - 1]?.timestamp || Date.now();
      
      // Calculate game duration in minutes
      const durationMs = lastTimestamp - firstTimestamp;
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      
      // Construct the historical event object
      const basicEventData = {
        id: history.eventId,
        name: eventName,
        country: "Historical",
        tournament: `Game duration: ${durationMinutes} min`,
        isInPlay: false,
        startTime: new Date(firstTimestamp).toISOString(),
        currentlyAvailable: false,
        marketAvailability: "COMPLETED",
        recordCount: history.timestamps.length,
        lastUpdate: lastTimestamp,
        homeTeam,
        awayTeam,
        gameMinute: 'FT'  // Full Time
      };
      historicalEvents.push(basicEventData);
    }
  });
  
  // Sort by lastUpdate, most recent first
  return historicalEvents.sort((a, b) => b.lastUpdate - a.lastUpdate);
}

export function getEventMarketHistory(eventId: string): { 
  timestamps: { timestamp: number; isAvailable: boolean; gameMinute?: string }[],
  uptimePercentage: number,
  totalMinutes: number,
  suspendedMinutes: number
} {
  console.log(`Getting market history for event ID: ${eventId}`);
  console.log(`Total market histories available: ${marketHistories.length}`);
  
  if (marketHistories.length > 0) {
    console.log(`Available event IDs: ${marketHistories.map(h => h.eventId).join(', ')}`);
  }
  
  const history = marketHistories.find(h => h.eventId === eventId);
  const event = heartbeatState.events.find(e => e.id === eventId);
  
  if (!history || history.timestamps.length === 0) {
    console.log(`No history found for event ID: ${eventId}`);
    return {
      timestamps: [],
      uptimePercentage: 0,
      totalMinutes: 0,
      suspendedMinutes: 0
    };
  }
  
  // Add game minute to each timestamp if available
  const timestampsWithGameMinute = history.timestamps.map(timestamp => {
    // If event is found, add the current game minute to all timestamps
    if (event && event.gameMinute) {
      return {
        ...timestamp,
        gameMinute: event.gameMinute
      };
    }
    return timestamp;
  });
  
  console.log(`Found history for event ID: ${eventId} with ${history.timestamps.length} data points`);
  
  // Calculate statistics based on actual time periods instead of just counts
  let availableTimeMs = 0;
  let totalTimeMs = 0;
  
  // Sort timestamps to ensure they're in chronological order
  const sortedTimestamps = [...history.timestamps].sort((a, b) => a.timestamp - b.timestamp);
  
  // Calculate time periods between consecutive measurements
  for (let i = 0; i < sortedTimestamps.length - 1; i++) {
    const currentTimestamp = sortedTimestamps[i];
    const nextTimestamp = sortedTimestamps[i + 1];
    
    // Time difference between this measurement and the next one (in milliseconds)
    const timeDiffMs = nextTimestamp.timestamp - currentTimestamp.timestamp;
    
    // Only count reasonable time differences (less than 5 minutes)
    // This prevents outliers when scraping was paused or irregular
    if (timeDiffMs > 0 && timeDiffMs < 300000) {
      totalTimeMs += timeDiffMs;
      
      // If market was available at this timestamp, add this time period to available time
      if (currentTimestamp.isAvailable) {
        availableTimeMs += timeDiffMs;
      }
    }
  }
  
  // Calculate uptime percentage based on time periods
  const uptimePercentage = totalTimeMs > 0 ? (availableTimeMs / totalTimeMs) * 100 : 0;
  
  // For backward compatibility, still provide these metrics
  const totalPoints = history.timestamps.length;
  const availableCount = history.timestamps.filter(t => t.isAvailable).length;
  
  // Convert milliseconds to minutes
  const totalMinutes = Math.round(totalTimeMs / 60000);
  const suspendedMinutes = Math.round(totalMinutes * (1 - (uptimePercentage / 100)));
  
  console.log(`Statistics for event ID ${eventId}: ${availableCount}/${totalPoints} available (${uptimePercentage.toFixed(1)}% uptime)`);
  
  // Create a simpler representation of the history with only a few data points for debugging
  const simplifiedTimestamps = history.timestamps.slice(0, 5).map(t => ({
    timestamp: t.timestamp,
    isAvailable: t.isAvailable,
    time: new Date(t.timestamp).toISOString()
  }));
  
  console.log(`Sample timestamps: ${JSON.stringify(simplifiedTimestamps)}`);
  
  return {
    timestamps: timestampsWithGameMinute,
    uptimePercentage: Math.round(uptimePercentage * 10) / 10, // Round to 1 decimal place
    totalMinutes,
    suspendedMinutes
  };
}

// Get current heartbeat status
export function getHeartbeatStatus(): HeartbeatState {
  return heartbeatState;
}

// Save history data to file
async function saveHistoryData(): Promise<void> {
  try {
    const dataDir = await ensureDataDirectory();
    const filePath = path.join(dataDir, 'heartbeat-history.json');
    
    await fs.writeFile(filePath, JSON.stringify(marketHistories), 'utf-8');
    console.log('Saved heartbeat history data');
  } catch (error) {
    console.error('Error saving heartbeat history data:', error);
    throw error;
  }
}

// Load history data from file
async function loadHistoryData(): Promise<void> {
  try {
    const dataDir = await ensureDataDirectory();
    const filePath = path.join(dataDir, 'heartbeat-history.json');
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      marketHistories = JSON.parse(data);
      console.log(`Loaded heartbeat history for ${marketHistories.length} events`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('No existing heartbeat history file found, starting fresh');
        marketHistories = [];
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error loading heartbeat history data:', error);
    throw error;
  }
}

// Clean up old data
function cleanupOldData(): void {
  const now = Date.now();
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
  
  // Remove entries older than a month
  for (const history of marketHistories) {
    history.timestamps = history.timestamps.filter(t => t.timestamp >= oneMonthAgo);
  }
  
  // Remove histories with no timestamps
  marketHistories = marketHistories.filter(h => h.timestamps.length > 0);
  
  console.log(`Cleaned up old data, keeping ${marketHistories.length} event histories`);
}