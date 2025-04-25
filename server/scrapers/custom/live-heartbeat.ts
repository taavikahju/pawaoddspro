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
    // Fetch data from API
    const events = await scrapeEvents(url);
    
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

    // Make request to the API
    const response = await axios.get(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

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
          
          // Fetch next page
          const pageResponse = await axios.get(newUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
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

  // Extract relevant data from events
  const processedEvents: HeartbeatEvent[] = events.map((event) => {
    // Extract country and tournament
    const country = event.category?.name || 'Unknown';
    const tournament = event.competition?.name || 'Unknown';
    
    // Check if 1X2 market is available (not suspended)
    const market1X2 = event.markets?.find((m: any) => m.type === '3743' || m.name === '1X2');
    const isMarketAvailable = market1X2 && market1X2.status !== 'SUSPENDED';
    
    // Create event object
    const heartbeatEvent: HeartbeatEvent = {
      id: event.id.toString(),
      name: event.name || 'Unnamed Event',
      country,
      tournament,
      isInPlay: event.status === 'LIVE' || event.isLive || false,
      startTime: event.startTime || new Date().toISOString(),
      currentlyAvailable: isMarketAvailable,
      marketAvailability: isMarketAvailable ? 'Available' : 'Suspended',
      recordCount: 0
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