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
      
      // Generate demo events instead of fetching from API
      const events = generateMockEvents();
      
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
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const data = response.data;
    
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format: expected array');
    }
    
    console.log(`Scraped ${data.length} events`);
    return data;
  } catch (error) {
    console.error('Error scraping events:', error);
    return [];
  }
}

// Process scraped events and update state
async function processEvents(events: any[]): Promise<void> {
  if (!events || events.length === 0) {
    console.log("No events to process - returning early");
    return;
  }

  console.log(`Processing ${events.length} live events for demo heartbeat...`);
  
  // For each demo event, log its structure and market status
  for (const event of events) {
    console.log(`DEMO EVENT: ID=${event.id}, Name=${event.name}, Market status=${event.markets?.[0]?.suspended ? "SUSPENDED" : "ACTIVE"}`);
    
    // Debug: log the scoreboard and market info for each event
    if (event.scoreboard?.display) {
      console.log(`    Minute: ${event.scoreboard.display.minute}`);
    }
    
    if (event.markets && event.markets.length > 0) {
      const market = event.markets[0];
      console.log(`    Market: typeId=${market.typeId || market.type}, suspended=${market.suspended}, prices=${market.prices?.length || 0}`);
      
      // Print price status
      if (market.prices && market.prices.length > 0) {
        market.prices.forEach((price: any, index: number) => {
          console.log(`      Price ${index + 1}: name=${price.name}, suspended=${price.suspended}, value=${price.price}`);
        });
      }
    }
  }

  // For our demo implementation, convert mock events directly to HeartbeatEvents
  const processedEvents: HeartbeatEvent[] = [];
  
  // Process each demo event
  for (const event of events) {
    try {
      const eventId = event.id.toString();
      const eventName = event.name;
      const country = event.category?.name || event.region?.name || "Unknown";
      const tournament = event.competition?.name || "Unknown";
      
      // Check if the market is available from the suspended flag
      const isMarketAvailable = event.markets && event.markets.length > 0 ? 
        !event.markets[0].suspended : false;
      
      // Get the game minute directly from the mock event
      const gameMinute = event.scoreboard?.display?.minute || "1";
      
      // Create a HeartbeatEvent directly from our mock event
      const heartbeatEvent: HeartbeatEvent = {
        id: eventId,
        name: eventName,
        country: country,
        tournament: tournament,
        isInPlay: true,
        startTime: event.startTime || new Date().toISOString(),
        currentlyAvailable: isMarketAvailable,
        marketAvailability: isMarketAvailable ? "ACTIVE" : "SUSPENDED",
        recordCount: 1,
        gameMinute: gameMinute,
        widgetId: event.widget?.id || "",
        homeTeam: eventName.split(" vs ")[0],
        awayTeam: eventName.split(" vs ")[1]
      };
      
      processedEvents.push(heartbeatEvent);
      console.log(`Added demo event to processed events: ${eventId} - ${eventName}`);
      
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
  // Return an array of event details with their histories
  const events = heartbeatState.events.map(event => {
    const history = marketHistories.find(h => h.eventId === event.id);
    if (history) {
      return {
        ...event,
        recordCount: history.timestamps.length,
        lastUpdate: history.timestamps[history.timestamps.length - 1]?.timestamp || Date.now()
      };
    }
    return null;
  }).filter(Boolean);
  
  // Add any historical events that are not in the current active events
  marketHistories.forEach(history => {
    const exists = events.some(e => e.id === history.eventId);
    if (!exists && history.timestamps.length > 0) {
      // This is a historical event not in current active set
      // Get the last event data if we have it
      const basicEventData = {
        id: history.eventId,
        name: `Historical Event ${history.eventId}`,
        country: "Unknown",
        tournament: "Unknown",
        recordCount: history.timestamps.length,
        lastUpdate: history.timestamps[history.timestamps.length - 1]?.timestamp || Date.now()
      };
      events.push(basicEventData);
    }
  });
  
  return events;
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
  
  // Calculate statistics
  let availableCount = 0;
  
  for (const timestamp of history.timestamps) {
    if (timestamp.isAvailable) {
      availableCount++;
    }
  }
  
  const totalPoints = history.timestamps.length;
  const uptimePercentage = totalPoints > 0 ? (availableCount / totalPoints) * 100 : 0;
  
  // Estimate minutes based on timestamp count (assuming ~1 reading per 10 seconds)
  const totalMinutes = Math.round(totalPoints / 6);
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