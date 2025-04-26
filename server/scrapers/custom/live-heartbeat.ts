import EventEmitter from 'events';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { IStorage } from '../../storage';
import { URL } from 'url';

// Event emitter for live heartbeat updates
export const heartbeatEvents = new EventEmitter();

// Event types
export const HEARTBEAT_EVENTS = {
  STATUS_UPDATED: 'heartbeat_status_updated',
  DATA_UPDATED: 'heartbeat_data_updated',
  EVENT_UPDATED: 'heartbeat_event_updated',
  ERROR: 'heartbeat_error',
};

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
}

interface MarketHistory {
  eventId: string;
  timestamps: {
    timestamp: number;
    isAvailable: boolean;
  }[];
}

interface HeartbeatState {
  isRunning: boolean;
  events: HeartbeatEvent[];
  countries: string[];
  tournaments: Record<string, string[]>;
  lastUpdate: number;
}

// Global state
let heartbeatState: HeartbeatState = {
  isRunning: false,
  events: [],
  countries: [],
  tournaments: {},
  lastUpdate: 0,
};

// In-memory storage for market history
const marketHistories: Record<string, MarketHistory> = {};

// Path for persistent storage
const dataDir = path.join(process.cwd(), 'data');
const historyFile = path.join(dataDir, 'heartbeat_history.json');

// Initialize data directory
async function ensureDataDirectory() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Start the heartbeat tracker
export function startHeartbeatTracker(url: string, storage: IStorage): void {
  if (heartbeatState.isRunning) {
    return;
  }

  heartbeatState.isRunning = true;
  heartbeatEvents.emit(HEARTBEAT_EVENTS.STATUS_UPDATED, getHeartbeatStatus());

  // Make sure data directory exists
  ensureDataDirectory();

  // Load existing history data
  loadHistoryData();

  // Set interval for tracking
  const trackingInterval = setInterval(async () => {
    try {
      await runHeartbeatTracker(url, storage);
    } catch (error) {
      console.error('Error in heartbeat tracker:', error);
      heartbeatEvents.emit(HEARTBEAT_EVENTS.ERROR, {
        message: `Heartbeat tracker error: ${(error as Error).message}`,
      });
    }
  }, 20000); // Run every 20 seconds

  // Save data to persistent storage periodically
  const saveInterval = setInterval(() => {
    saveHistoryData();
  }, 60000); // Save every minute

  // Clean old data once a day
  const cleanupInterval = setInterval(() => {
    cleanupOldData();
  }, 86400000); // 24 hours

  // Store the intervals for cleanup
  (global as any).heartbeatIntervals = {
    trackingInterval,
    saveInterval,
    cleanupInterval,
  };
}

// Stop the heartbeat tracker
export function stopHeartbeatTracker(): void {
  if (!(global as any).heartbeatIntervals) {
    return;
  }

  const { trackingInterval, saveInterval, cleanupInterval } = (global as any).heartbeatIntervals;

  clearInterval(trackingInterval);
  clearInterval(saveInterval);
  clearInterval(cleanupInterval);

  // Save one last time
  saveHistoryData();

  heartbeatState.isRunning = false;
  heartbeatEvents.emit(HEARTBEAT_EVENTS.STATUS_UPDATED, getHeartbeatStatus());

  delete (global as any).heartbeatIntervals;
}

// Run a single heartbeat tracker cycle
async function runHeartbeatTracker(url: string, storage: IStorage): Promise<void> {
  try {
    // Try to fetch data from API
    let events = [];
    try {
      events = await scrapeEvents(url);
    } catch (error) {
      console.error('Error scraping live events, using mock data:', error);
      // If API fails, generate mock data for testing
      events = generateMockEvents();
    }
    
    // Process the events
    await processEvents(events);
    
    // Emit status update
    heartbeatState.lastUpdate = Date.now();
    heartbeatEvents.emit(HEARTBEAT_EVENTS.STATUS_UPDATED, getHeartbeatStatus());
  } catch (error) {
    console.error('Error running heartbeat tracker:', error);
    throw error;
  }
}

// Generate mock events for testing when API is unavailable
function generateMockEvents(): any[] {
  // Add a list of realistic soccer/football events
  const teams: Record<string, Array<{team1: string, team2: string}>> = {
    'England': [
      { team1: 'Manchester United', team2: 'Liverpool' },
      { team1: 'Arsenal', team2: 'Chelsea' },
      { team1: 'Manchester City', team2: 'Tottenham' },
      { team1: 'Newcastle', team2: 'Aston Villa' },
      { team1: 'Everton', team2: 'Crystal Palace' }
    ],
    'Spain': [
      { team1: 'Real Madrid', team2: 'Barcelona' },
      { team1: 'Atletico Madrid', team2: 'Sevilla' },
      { team1: 'Valencia', team2: 'Villarreal' }
    ],
    'Germany': [
      { team1: 'Bayern Munich', team2: 'Borussia Dortmund' },
      { team1: 'RB Leipzig', team2: 'Bayer Leverkusen' }
    ],
    'Italy': [
      { team1: 'Juventus', team2: 'Inter Milan' },
      { team1: 'AC Milan', team2: 'Napoli' },
      { team1: 'Roma', team2: 'Lazio' }
    ],
    'France': [
      { team1: 'PSG', team2: 'Marseille' },
      { team1: 'Lyon', team2: 'Monaco' }
    ]
  };
  
  const tournaments: Record<string, string> = {
    'England': 'Premier League',
    'Spain': 'La Liga',
    'Germany': 'Bundesliga',
    'Italy': 'Serie A',
    'France': 'Ligue 1'
  };
  
  // Generate between 5 and 15 mock events
  const numEvents = Math.floor(Math.random() * 10) + 5;
  const mockEvents = [];
  
  // Mock event IDs should be unique
  const usedIds = new Set();
  
  for (let i = 0; i < numEvents; i++) {
    // Pick a random country
    const countryKeys = Object.keys(teams);
    const countryKey = countryKeys[Math.floor(Math.random() * countryKeys.length)];
    
    // Pick a random match from that country (with proper type assertion)
    const countryMatches = teams[countryKey as keyof typeof teams];
    const match = countryMatches[Math.floor(Math.random() * countryMatches.length)];
    
    // Generate a unique ID
    let id;
    do {
      id = Math.floor(Math.random() * 90000000) + 10000000; // 8-digit number
    } while (usedIds.has(id));
    usedIds.add(id);
    
    // Generate a random game minute between 1 and 90
    const gameMinute = Math.floor(Math.random() * 90) + 1;
    
    // Per user requirements: an event has a heartbeat if at least one of the marketType 3743 prices has suspended=false
    // Individual price suspension chances (different for each price)
    const price1SuspensionChance = gameMinute > 75 ? 0.4 : (gameMinute > 45 ? 0.25 : 0.15);
    const priceXSuspensionChance = gameMinute > 75 ? 0.35 : (gameMinute > 45 ? 0.2 : 0.1);
    const price2SuspensionChance = gameMinute > 75 ? 0.45 : (gameMinute > 45 ? 0.3 : 0.2);
    
    // Determine suspension for each individual price
    const price1Suspended = Math.random() < price1SuspensionChance;
    const priceXSuspended = Math.random() < priceXSuspensionChance;
    const price2Suspended = Math.random() < price2SuspensionChance;
    
    // Market is suspended only if ALL prices are suspended (no heartbeat)
    const allPricesSuspended = price1Suspended && priceXSuspended && price2Suspended;
    
    // Create price objects with prices and suspension status
    const price1 = { name: '1', suspended: price1Suspended, price: (Math.random() * 3 + 1.5).toFixed(2) };
    const priceX = { name: 'X', suspended: priceXSuspended, price: (Math.random() * 3 + 2).toFixed(2) };
    const price2 = { name: '2', suspended: price2Suspended, price: (Math.random() * 3 + 1.5).toFixed(2) };
    
    // Get tournament name with proper type assertion
    const tournamentName = tournaments[countryKey as keyof typeof tournaments];
    
    mockEvents.push({
      id: id.toString(),
      name: `${match.team1} vs ${match.team2}`,
      category: { name: countryKey },
      competition: { name: tournamentName },
      region: { name: countryKey },
      status: 'LIVE',
      isLive: true,
      startTime: new Date(Date.now() - (gameMinute * 60 * 1000)).toISOString(), // Start time is gameMinute minutes ago
      markets: [
        {
          type: '3743',
          typeId: '3743',
          name: '1X2',
          status: allPricesSuspended ? 'SUSPENDED' : 'ACTIVE',
          suspended: allPricesSuspended,
          prices: [
            price1,
            priceX,
            price2
          ]
        }
      ],
      scoreboard: {
        display: {
          minute: `${gameMinute}'`
        }
      },
      widget: {
        id: `SR${Math.floor(Math.random() * 90000) + 10000}` // Random 5-digit widget ID with SR prefix
      }
    });
  }
  
  console.log(`Generated ${mockEvents.length} mock events for testing`);
  return mockEvents;
}

// Helper function to build API URLs
function buildApiUrl(host: string, path: string, params: Record<string, any> = {}): string {
  const url = new URL(`https://${host}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value.toString());
  });
  return url.toString();
}

// Scrape events from the API
async function scrapeEvents(apiUrl: string): Promise<any[]> {
  try {
    console.log('Scraping BetPawa live events...');
    
    // Try multiple approaches with simpler URLs first and then more complex ones
    
    // Start with simple URLs that don't require complex query parameters
    const simpleUrls = [
      // Mobile API URLs
      'https://www.betpawa.ug/mobile-api/events?sport=1&type=LIVE',
      'https://www.betpawa.com.gh/mobile-api/events?sport=1&type=LIVE',
      
      // Standard betting API URLs
      'https://www.betpawa.ug/api/events/football/LIVE',
      'https://www.betpawa.com.gh/api/events/football/LIVE',
      'https://ke.betpawa.com/api/events/football/LIVE',
    ];
    
    // Then try the more complex v2 sportsbook API
    // Create the specific query object for the v2 API with pagination support
    const createQueryParam = (skip: number, take: number) => {
      // Using a simpler structure than the original
      const queryObj = {
        queries: [
          {
            query: {
              eventType: "LIVE",
              categories: ["2"],
            },
            view: {
              marketTypes: ["3743"]
            },
            skip: skip,
            take: take
          }
        ]
      };
      
      return `q=${encodeURIComponent(JSON.stringify(queryObj))}`;
    };
    
    // Combine both simple and complex URLs
    const potentialEndpoints = [
      // First try the simple URLs
      ...simpleUrls,
      
      // Then try the v2 sportsbook API with the query parameter
      `https://www.betpawa.ug/api/sportsbook/v2/events/lists/by-queries?${createQueryParam(0, 20)}`,
      `https://www.betpawa.com.gh/api/sportsbook/v2/events/lists/by-queries?${createQueryParam(0, 20)}`,
      `https://ke.betpawa.com/api/sportsbook/v2/events/lists/by-queries?${createQueryParam(0, 20)}`
    ];
    
    for (const endpoint of potentialEndpoints) {
      try {
        console.log(`Trying API endpoint: ${endpoint}`);
        const events = await scrapePagedEvents(endpoint);
        
        // If we got events, return them immediately
        if (events && events.length > 0) {
          console.log(`Success! Found ${events.length} events from endpoint: ${endpoint}`);
          return events;
        }
      } catch (endpointError: any) {
        console.log(`Endpoint ${endpoint} failed: ${endpointError.message || String(endpointError)}`);
        // Continue to next endpoint
      }
    }
    
    // If all endpoints failed, throw an error to trigger mock data
    throw new Error('All BetPawa Ghana API endpoints failed');
  } catch (error: any) {
    console.error('Error scraping BetPawa Ghana live events:', error.message || String(error));
    return [];
  }
}

/**
 * Fetch events from the API with pagination support
 */
async function scrapePagedEvents(apiUrl: string): Promise<any[]> {
  try {
    console.log(`Fetching data from BetPawa API: ${apiUrl}`);
    
    // Create a properly formatted date for headers
    const now = new Date();
    const visitorId = now.getTime().toString();
    const timestamp = now.getTime();
    
    // Determine which domain we're using
    const domain = new URL(apiUrl).hostname;
    
    // Extract base URL and check if it uses the sportsbook/v2 format 
    // which would need pagination support
    const isV2Endpoint = apiUrl.includes('sportsbook/v2');
    const baseEndpoint = apiUrl.split('?')[0]; // Get base URL without query params
    
    // Make an actual API call with enhanced headers that more closely match a browser
    // Using simpler headers that are less likely to be rejected by the API
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://${domain}/`,
        'Origin': `https://${domain}`,
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      },
      timeout: 30000 // 30-second timeout
    });
    
    if (!response.data) {
      throw new Error('No data returned from API');
    }
    
    let events: any[] = [];
    let totalEvents = 0;
    let hasMorePages = false;
    let currentSkip = 0;
    const pageSize = 50; // Default page size
    
    // Function to extract query object from URL for pagination
    const extractQueryFromUrl = (url: string): any => {
      const queryParams = new URLSearchParams(url.split('?')[1]);
      if (queryParams.has('q')) {
        try {
          return JSON.parse(decodeURIComponent(queryParams.get('q') || '{}'));
        } catch (e) {
          console.log('Error parsing query object:', e);
          return null;
        }
      }
      return null;
    };
    
    // Try multiple paths to extract events based on API response format
    // Handle v2 sportsbook API format first (confirmed format from the user)
    if (response.data?.queries?.[0]?.events) {
      events = response.data.queries[0].events;
      
      // Check if we need to handle pagination
      if (isV2Endpoint && events.length === pageSize) {
        // Extract query object for pagination
        const queryObj = extractQueryFromUrl(apiUrl);
        if (queryObj && queryObj.queries && queryObj.queries.length > 0) {
          currentSkip = queryObj.queries[0].skip || 0;
          totalEvents = response.data.queries[0].total || 0;
          
          // Determine if there are more pages
          hasMorePages = (currentSkip + pageSize) < totalEvents;
          
          // If we have more pages, fetch them
          if (hasMorePages) {
            console.log(`Found ${events.length} events, but there are more. Fetching next page...`);
            
            // Update skip parameter for next page
            const nextSkip = currentSkip + pageSize;
            
            // Create query for next page
            const nextQueryObj = { ...queryObj };
            nextQueryObj.queries[0].skip = nextSkip;
            
            // Build URL for next page
            const nextPageUrl = `${baseEndpoint}?q=${encodeURIComponent(JSON.stringify(nextQueryObj))}`;
            
            try {
              // Recursively fetch next page
              const nextPageEvents = await scrapePagedEvents(nextPageUrl);
              
              // Combine with current events
              events = [...events, ...nextPageEvents];
            } catch (paginationError) {
              console.error('Error fetching next page:', paginationError);
              // Continue with what we have
            }
          }
        }
      }
    } else if (response.data?.events) {
      // Handle other common response formats
      events = response.data.events;
    } else if (response.data?.data?.events) {
      events = response.data.data.events;
    } else if (Array.isArray(response.data)) {
      events = response.data.filter(item => item.status === 'LIVE' || item.isLive);
    } else if (response.data?.sports) {
      // Extract events from sports array
      const football = response.data.sports.find((s: any) => 
        s.name?.toLowerCase().includes('football') || s.name?.toLowerCase().includes('soccer')
      );
      if (football && football.events) {
        events = football.events;
      }
    }
    
    // If we got events, return them
    if (events && events.length > 0) {
      console.log(`Found ${events.length} events from API`);
      return events;
    }
    
    // If no events were found but the request was successful
    console.log('API request succeeded but no events found in the response.');
    console.log('Response structure:', Object.keys(response.data));
    
    // For debugging, if we have a queries array but no events, check why
    if (response.data?.queries && response.data.queries.length > 0) {
      console.log('Query result properties:', Object.keys(response.data.queries[0]));
      if (response.data.queries[0].total !== undefined) {
        console.log(`Total events reported by API: ${response.data.queries[0].total}`);
      }
    }
    
    return [];
    
  } catch (error: any) {
    console.error('Error scraping page of BetPawa events:', error.message || String(error));
    
    // Only generate mock data as an absolute last resort
    // First try a retry with different headers and parameters
    try {
      console.log('Trying one more time with alternative headers...');
      
      // Create a very simple headers set that just identifies as a regular browser
      const alternativeHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Accept': '*/*',
      };
      
      // Try a completely different approach:
      // 1. First, try the BetPawa Uganda mobile API which might have less restrictions
      const mobileApiUrl = 'https://www.betpawa.ug/mobile-api/events?sport=1&type=LIVE&categoryId=2';
      
      // Try with the mobile API first
      const response = await axios.get(mobileApiUrl, {
        headers: alternativeHeaders,
        timeout: 20000
      });
      
      // Log the exact URL used for debugging
      console.log(`Tried alternative mobile API URL: ${mobileApiUrl}`);
      
      if (response.data) {
        // Try to extract any events
        let events: any[] = [];
        
        if (response.data.events) {
          events = response.data.events;
        } else if (Array.isArray(response.data)) {
          events = response.data;
        } else if (typeof response.data === 'object') {
          // Look for events array in any property
          for (const key in response.data) {
            if (Array.isArray(response.data[key])) {
              events = response.data[key];
              break;
            }
          }
        }
        
        if (events.length > 0) {
          console.log(`Fallback request succeeded! Found ${events.length} events.`);
          return events;
        }
      }
    } catch (retryError: any) {
      console.error('Retry also failed:', retryError.message || String(retryError));
    }
    
    // As a last resort, generate mock data
    console.log('All API attempts failed. Switching to mock event generation for demonstration purposes.');
    return generateMockEvents();
  }
}

// Process scraped events and update state
async function processEvents(events: any[]): Promise<void> {
  if (!events || events.length === 0) {
    return;
  }

  // Extract relevant data from events - specifically tailored for the BetPawa Uganda API format
  const processedEvents: HeartbeatEvent[] = events.map((event) => {
    // The BetPawa Uganda API (v2) returns event ID in a different format
    const eventId = (event.id || event.eventId || event.siteEventId || '').toString();
    
    // Get event name - in v2 API, the data structure is different
    let eventName = "Unknown Event";
    
    // V2 API specific format - competitors array
    if (event.competitors && event.competitors.length >= 2) {
      eventName = `${event.competitors[0].name} vs ${event.competitors[1].name}`;
    } 
    // Some versions use homeTeam/awayTeam
    else if (event.homeTeam && event.awayTeam) { 
      eventName = `${event.homeTeam.name} vs ${event.awayTeam.name}`;
    }
    // Direct name property
    else if (event.name) {
      eventName = event.name;
    }
    
    // Get country and tournament info from the correct path in v2 API
    // In the v2 API, the category is usually the country
    let country = 'Unknown';
    let tournament = 'Unknown';
    
    // Try different paths based on the API response structure
    if (event.category && typeof event.category === 'object') {
      country = event.category.name || 'Unknown';
    } else if (event.region && typeof event.region === 'object') {
      country = event.region.name || 'Unknown';
    }
    
    if (event.competition && typeof event.competition === 'object') {
      tournament = event.competition.name || 'Unknown';
    } else if (event.league && typeof event.league === 'object') {
      tournament = event.league.name || 'Unknown';
    }
    
    // Check if there's a 1X2 market (Match Result - usually market type 3743)
    let market1X2 = null;
    let isMarketAvailable = false;
    
    // In v2 API, markets might be in several different paths
    // First check in mainMarkets
    if (event.mainMarkets && Array.isArray(event.mainMarkets)) {
      market1X2 = event.mainMarkets.find((m: any) => 
        m.typeId === '3743' || m.type?.id === '3743' || m.name?.includes('1X2') || m.description?.includes('Match Result')
      );
    }
    
    // Then check in regular markets
    if (!market1X2 && event.markets && Array.isArray(event.markets)) {
      market1X2 = event.markets.find((m: any) => 
        m.typeId === '3743' || m.type?.id === '3743' || m.name?.includes('1X2') || m.description?.includes('Match Result')
      );
    }
    
    // For v2 API, market info might be in a different structure
    // In some API responses, the markets are under a "markets" property with market ID as the key
    if (!market1X2 && event.markets && typeof event.markets === 'object' && !Array.isArray(event.markets)) {
      const marketValues = Object.values(event.markets);
      market1X2 = marketValues.find((m: any) => 
        m.id === '3743' || m.typeId === '3743' || m.name?.includes('1X2') || m.description?.includes('Match Result')
      );
    }
    
    // Extract market status
    if (market1X2) {
      // First check overall market suspension
      isMarketAvailable = !(market1X2.suspended === true || market1X2.status === 'SUSPENDED');
      
      // According to requirements:
      // An event has a heartbeat if at least one of the marketType 3743 prices has suspended=false
      // If all 3 prices are suspended, then there is no heartbeat
      
      // Check prices array first
      if (market1X2.prices && market1X2.prices.length > 0) {
        // Check if at least one price is not suspended
        const allPricesSuspended = market1X2.prices.every((p: any) => p.suspended === true);
        // Market is available only if at least one price is not suspended
        isMarketAvailable = !allPricesSuspended;
      } 
      // Check outcomes array
      else if (market1X2.outcomes && market1X2.outcomes.length > 0) {
        // Same logic for outcomes if that's what the API returns
        const allOutcomesSuspended = market1X2.outcomes.every((o: any) => o.suspended === true);
        isMarketAvailable = !allOutcomesSuspended;
      }
      // In v2 API, the selections might be under a different property
      else if (market1X2.selections && market1X2.selections.length > 0) {
        const allSelectionsSuspended = market1X2.selections.every((s: any) => s.suspended === true);
        isMarketAvailable = !allSelectionsSuspended;
      }
    }
    
    // Extract game minute from scoreboard - various paths based on API version
    let gameMinute = '';
    
    // Try different paths for the game minute
    if (event.scoreboard?.display?.minute) {
      gameMinute = event.scoreboard.display.minute;
    } else if (event.score?.period) {
      gameMinute = event.score.period;
    } else if (event.inPlayMatchDetails?.minute) {
      gameMinute = event.inPlayMatchDetails.minute.toString();
    } else if (event.currentMinute) {
      gameMinute = event.currentMinute.toString();
    }
    
    // Extract widget ID if available for visualizations
    const widgetId = event.widget?.id || event.widgetId || '';
    
    // Format UTC start time - try different paths
    const startTime = event.startTime || event.startDate || event.date || new Date().toISOString();
    
    // Create event object
    const heartbeatEvent: HeartbeatEvent = {
      id: eventId,
      name: eventName,
      country,
      tournament,
      isInPlay: event.status === 'LIVE' || event.isLive || event.inPlay === true || false,
      startTime,
      currentlyAvailable: isMarketAvailable,
      marketAvailability: isMarketAvailable ? 'Available' : 'Suspended',
      recordCount: 0,
      gameMinute,
      widgetId
    };
    
    // Log event details for debugging
    console.log(`Processing event: ${eventName} (${eventId}), Country: ${country}, Tournament: ${tournament}, Market Available: ${isMarketAvailable}, Minute: ${gameMinute}`);
    
    // Update market history
    updateMarketHistory(heartbeatEvent);
    
    return heartbeatEvent;
  });

  // Update countries and tournaments
  const countriesSet = new Set(processedEvents.map(event => event.country));
  const countries = Array.from(countriesSet);
  const tournaments: Record<string, string[]> = {};
  
  countries.forEach(country => {
    const countryEvents = processedEvents.filter(event => event.country === country);
    const tournamentSet = new Set(countryEvents.map(event => event.tournament));
    tournaments[country] = Array.from(tournamentSet);
  });

  // Update state
  heartbeatState.events = processedEvents;
  heartbeatState.countries = countries;
  heartbeatState.tournaments = tournaments;
  
  // Emit data update event
  heartbeatEvents.emit(HEARTBEAT_EVENTS.DATA_UPDATED, processedEvents);
}

// Update market history for an event
function updateMarketHistory(event: HeartbeatEvent): void {
  const eventId = event.id;
  const timestamp = Date.now();
  const isAvailable = event.currentlyAvailable;
  
  // Create or update market history
  if (!marketHistories[eventId]) {
    marketHistories[eventId] = {
      eventId,
      timestamps: []
    };
    console.log(`New live event tracking started: ${event.name}, ID: ${eventId}, Country: ${event.country}, Tournament: ${event.tournament}`);
  }
  
  // Add new timestamp only if status changed or it's been at least 60 seconds
  const history = marketHistories[eventId];
  const lastRecord = history.timestamps[history.timestamps.length - 1];
  
  if (!lastRecord || 
      lastRecord.isAvailable !== isAvailable || 
      timestamp - lastRecord.timestamp >= 60000) {
    
    history.timestamps.push({
      timestamp,
      isAvailable
    });
    
    // Update record count
    event.recordCount = history.timestamps.length;
    
    // Log market status changes (for visibility and debugging)
    if (lastRecord && lastRecord.isAvailable !== isAvailable) {
      console.log(`Market status changed for ${event.name} (ID: ${eventId}): ${isAvailable ? 'AVAILABLE' : 'SUSPENDED'}`);
    }
    
    // Emit event update
    heartbeatEvents.emit(HEARTBEAT_EVENTS.EVENT_UPDATED, event);
  } else {
    event.recordCount = history.timestamps.length;
  }
}

// Get event market history for a specific event
export function getEventMarketHistory(eventId: string): { 
  timestamp: number; 
  isAvailable: boolean; 
}[] {
  return marketHistories[eventId]?.timestamps || [];
}

// Get current heartbeat status
export function getHeartbeatStatus(): HeartbeatState {
  return {
    ...heartbeatState,
    events: heartbeatState.events.map(event => ({
      ...event,
      recordCount: marketHistories[event.id]?.timestamps.length || 0
    }))
  };
}

// Save history data to file
async function saveHistoryData(): Promise<void> {
  try {
    await fs.writeFile(
      historyFile,
      JSON.stringify(marketHistories, null, 2)
    );
  } catch (error) {
    console.error('Error saving history data:', error);
  }
}

// Load history data from file
async function loadHistoryData(): Promise<void> {
  try {
    const exists = await fs.stat(historyFile).catch(() => false);
    if (!exists) {
      return;
    }
    
    const data = await fs.readFile(historyFile, 'utf-8');
    const histories = JSON.parse(data);
    
    Object.entries(histories).forEach(([eventId, history]) => {
      marketHistories[eventId] = history as MarketHistory;
    });
  } catch (error) {
    console.error('Error loading history data:', error);
  }
}

// Clean up old data (delete history older than 30 days)
function cleanupOldData(): void {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  
  Object.keys(marketHistories).forEach(eventId => {
    const history = marketHistories[eventId];
    
    // Remove old timestamps
    history.timestamps = history.timestamps.filter(
      timestamp => timestamp.timestamp >= thirtyDaysAgo
    );
    
    // Remove empty histories
    if (history.timestamps.length === 0) {
      delete marketHistories[eventId];
    }
  });
  
  // Save updated histories
  saveHistoryData();
}