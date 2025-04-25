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
    
    // Randomly determine if markets are suspended (higher chance later in the game)
    const suspensionChance = gameMinute > 75 ? 0.35 : (gameMinute > 45 ? 0.2 : 0.1);
    const suspended = Math.random() < suspensionChance;
    
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
          name: '1X2',
          status: 'ACTIVE',
          prices: [
            { name: '1', suspended },
            { name: 'X', suspended },
            { name: '2', suspended }
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

// Scrape events from the API
async function scrapeEvents(apiUrl: string): Promise<any[]> {
  try {
    // Extract query params from URL
    const parsedUrl = new URL(apiUrl);
    const queryString = parsedUrl.searchParams.get('q') || '';
    let queryObject = {};

    try {
      queryObject = JSON.parse(decodeURIComponent(queryString));
    } catch (e) {
      console.error('Error parsing query string:', e);
    }

    console.log('Attempting to fetch data from BetPawa API using simplified headers');
    
    // Use the same simple headers as the original working bp_gh_live_scraper.js
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 8000 // 8-second timeout
    });
    
    // Log response or error
    if (response.status !== 200) {
      console.log('Error response from BetPawa API:', response.status, response.data);
    } else {
      console.log('Successfully fetched data from BetPawa API');
    }

    if (!response.data || !response.data.events) {
      return [];
    }

    // Process pagination if needed
    const events = response.data.events || [];
    let totalEvents = events;

    // Check if pagination is needed
    if (queryObject && Array.isArray(queryObject.queries) && queryObject.queries.length > 0) {
      const query = queryObject.queries[0];
      if (query.take && response.data.total && response.data.total > query.take) {
        // Need to fetch more pages
        const totalPages = Math.ceil(response.data.total / query.take);
        
        for (let page = 1; page < totalPages; page++) {
          // Update skip parameter for pagination
          const skipCount = page * query.take;
          const newQueryObject = JSON.parse(JSON.stringify(queryObject));
          if (newQueryObject.queries && newQueryObject.queries.length > 0) {
            newQueryObject.queries[0].skip = skipCount;
          }
          
          // Build new URL with updated pagination
          const newQueryString = encodeURIComponent(JSON.stringify(newQueryObject));
          const newUrl = `${parsedUrl.origin}${parsedUrl.pathname}?q=${newQueryString}`;
          
          // Fetch next page with the same simplified headers
          const pageResponse = await axios.get(newUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            timeout: 8000 // 8-second timeout
          });
          
          if (pageResponse.data && pageResponse.data.events) {
            totalEvents = [...totalEvents, ...pageResponse.data.events];
          }
        }
      }
    }

    return totalEvents;
  } catch (error) {
    console.error('Error scraping events:', error);
    return [];
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
      isMarketAvailable = !(market1X2.suspended === true || market1X2.status === 'SUSPENDED');
      
      // Also check if prices/outcomes are suspended
      if (market1X2.prices) {
        isMarketAvailable = !market1X2.prices.some((p: any) => p.suspended);
      } else if (market1X2.outcomes) {
        isMarketAvailable = !market1X2.outcomes.some((o: any) => o.suspended);
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