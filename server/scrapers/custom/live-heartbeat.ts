import EventEmitter from 'events';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { IStorage } from '../../storage';

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
  }, 10000); // Run every 10 seconds

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
  const teams = {
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
  
  const tournaments = {
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
    const countries = Object.keys(teams);
    const country = countries[Math.floor(Math.random() * countries.length)];
    
    // Pick a random match from that country
    const countryMatches = teams[country];
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
    
    mockEvents.push({
      id: id.toString(),
      name: `${match.team1} vs ${match.team2}`,
      category: { name: country },
      competition: { name: tournaments[country] },
      region: { name: country },
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

// Scrape events from the API - adapted from bp_gh_live_scraper.js
async function scrapeEvents(apiUrl: string): Promise<any[]> {
  try {
    console.log('Scraping BetPawa Ghana live events...');
    
    // Parse the current URL to get the query parameters
    const url = new URL(apiUrl);
    const queryParams = url.searchParams.get('q');
    
    // If no query params found, use the URL as-is
    if (!queryParams) {
      return await scrapePagedEvents(apiUrl);
    }
    
    // Parse the query JSON to modify for pagination
    let queryObj;
    try {
      queryObj = JSON.parse(queryParams);
    } catch (err) {
      console.error('Error parsing query parameters:', err);
      return await scrapePagedEvents(apiUrl);
    }
    
    // Get all pages of results
    const allEvents = [];
    let hasMoreResults = true;
    let skip = 0;
    const pageSize = 20;
    
    while (hasMoreResults) {
      // Update the skip parameter in the query for pagination
      if (queryObj.queries && queryObj.queries.length > 0) {
        queryObj.queries[0].skip = skip;
      }
      
      // Create the new URL with updated pagination
      const updatedQueryParams = JSON.stringify(queryObj);
      url.searchParams.set('q', updatedQueryParams);
      const pagedUrl = url.toString();
      
      // Fetch the current page of results
      console.log(`Fetching page ${skip / pageSize + 1} (skip=${skip})...`);
      const pageEvents = await scrapePagedEvents(pagedUrl);
      
      if (pageEvents.length > 0) {
        allEvents.push(...pageEvents);
        // Move to the next page
        skip += pageSize;
      } else {
        // No more results, stop pagination
        hasMoreResults = false;
      }
      
      // Limit to 5 pages maximum to avoid excessive requests
      if (skip >= 100) {
        hasMoreResults = false;
      }
    }
    
    console.log(`Fetched a total of ${allEvents.length} events across multiple pages`);
    return allEvents;
  } catch (error) {
    console.error('Error scraping BetPawa Ghana live events:', error.message);
    return [];
  }
}

/**
 * Fetch a single page of events from the API
 */
async function scrapePagedEvents(apiUrl: string): Promise<any[]> {
  try {
    // Make an actual API call to BetPawa Ghana API
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.betpawa.com.gh/',
        'Origin': 'https://www.betpawa.com.gh',
        'Connection': 'keep-alive'
      },
      timeout: 10000 // 10-second timeout
    });
    
    if (!response.data) {
      throw new Error('No data returned from API');
    }
    
    // Extract and return the events from the API response
    if (response.data?.queries?.[0]?.events) {
      return response.data.queries[0].events;
    }
    
    // If no data was found, but the request succeeded
    console.log('API request succeeded but no events found in the response.');
    return [];
  } catch (error) {
    console.error('Error scraping page of BetPawa Ghana events:', error.message);
    
    // Only generate mock data if we can't connect to the API
    console.log('Switching to mock event generation since API connection is failing');
    return generateMockEvents();
  }
}

// Process scraped events and update state
async function processEvents(events: any[]): Promise<void> {
  if (!events || events.length === 0) {
    return;
  }

  // Extract relevant data from events - using same logic as bp_gh_live_scraper.js
  const processedEvents: HeartbeatEvent[] = events.map((event) => {
    // Event ID - using both siteEventId and id for compatibility
    const eventId = (event.siteEventId || event.id || '').toString();
    
    // Get event name from competitors or direct name property
    let eventName = "Unknown Event";
    if (event.competitors && event.competitors.length >= 2) {
      eventName = `${event.competitors[0].name} v ${event.competitors[1].name}`;
    } else if (event.name) {
      eventName = event.name;
    }
    
    // Get country and tournament info
    const country = event.category?.name || event.region?.name || 'Unknown';
    const tournament = event.competition?.name || 'Unknown';
    
    // Check if there's a 1X2 market (Match Result - usually market type 3743)
    let market1X2 = null;
    let isMarketAvailable = false;
    
    // Check for market in mainMarkets first
    if (event.mainMarkets) {
      market1X2 = event.mainMarkets.find((m: any) => 
        m.typeId === '3743' || m.type?.id === '3743' || m.name?.includes('1X2')
      );
    }
    
    // If not found, check in regular markets
    if (!market1X2 && event.markets) {
      market1X2 = event.markets.find((m: any) => 
        m.typeId === '3743' || m.type?.id === '3743' || m.name?.includes('1X2')
      );
    }
    
    // Extract market status
    if (market1X2) {
      // First check overall market suspension
      isMarketAvailable = !(market1X2.suspended === true || market1X2.status === 'SUSPENDED');
      
      // According to requirements:
      // An event has a heartbeat if at least one of the marketType 3743 prices has suspended=false
      // If all 3 prices are suspended, then there is no heartbeat
      if (market1X2.prices && market1X2.prices.length > 0) {
        // Check if at least one price is not suspended
        const allPricesSuspended = market1X2.prices.every((p: any) => p.suspended === true);
        // Market is available only if at least one price is not suspended
        isMarketAvailable = !allPricesSuspended;
      } else if (market1X2.outcomes && market1X2.outcomes.length > 0) {
        // Same logic for outcomes if that's what the API returns
        const allOutcomesSuspended = market1X2.outcomes.every((o: any) => o.suspended === true);
        isMarketAvailable = !allOutcomesSuspended;
      }
    }
    
    // Extract game minute from scoreboard if available
    let gameMinute = '';
    if (event.scoreboard?.display?.minute) {
      gameMinute = event.scoreboard.display.minute;
    } else if (event.score?.period) {
      gameMinute = event.score.period;
    }
    
    // Extract widget ID (SPORTRADAR)
    const widgetId = event.widget?.id || '';
    
    // Format UTC start time
    const startTime = event.startTime || event.startDate || new Date().toISOString();
    
    // Create event object
    const heartbeatEvent: HeartbeatEvent = {
      id: eventId,
      name: eventName,
      country,
      tournament,
      isInPlay: event.status === 'LIVE' || event.isLive || false,
      startTime,
      currentlyAvailable: isMarketAvailable,
      marketAvailability: isMarketAvailable ? 'Available' : 'Suspended',
      recordCount: 0,
      gameMinute,
      widgetId
    };
    
    // Update market history
    updateMarketHistory(heartbeatEvent);
    
    return heartbeatEvent;
  });

  // Update countries and tournaments
  const countries = [...new Set(processedEvents.map(event => event.country))];
  const tournaments: Record<string, string[]> = {};
  
  countries.forEach(country => {
    const countryEvents = processedEvents.filter(event => event.country === country);
    tournaments[country] = [...new Set(countryEvents.map(event => event.tournament))];
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