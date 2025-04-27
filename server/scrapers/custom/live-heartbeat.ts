import axios, { AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { IStorage } from '../../storage';
// Import path and fileURLToPath for ES Modules directory path handling
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';

// Debug utility function to save API responses for analysis
function debugDumpApiResponse(event: any, source: string) {
  try {
    const logDir = path.join(process.cwd(), 'data', 'logs');
    
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(logDir, `${source}-event-${event.id || 'unknown'}-${timestamp}.json`);
    
    fs.writeFileSync(filePath, JSON.stringify(event, null, 2));
    console.log(`Dumped ${source} event to ${filePath}`);
  } catch (error) {
    console.error('Error dumping event for debugging:', error);
  }
}

// Create an event emitter to handle heartbeat events
export const heartbeatEvents = new EventEmitter();

// Define event types
export const HEARTBEAT_EVENTS = {
  STATUS_UPDATED: 'status_updated',
  MARKET_CHANGED: 'market_changed',
  HEARTBEAT: 'heartbeat'
};

// Define the shape of a heartbeat event
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
  suspended?: boolean; // Explicit suspended flag for better TypeScript type safety
  finished?: boolean; // Flag to mark events that are finished
  lastSeen?: number; // Timestamp of when we last saw this event in API responses
  totalMarketCount?: number; // Added to track the actual number of markets available
}

// Define the structure for market history
interface MarketHistory {
  eventId: string;
  timestamps: {
    timestamp: number;
    isAvailable: boolean;
    marketStatus?: string; // Optional to maintain backward compatibility
    gameMinute?: string; // Game minute for live events
  }[];
}

// Heartbeat state interface
interface HeartbeatState {
  isRunning: boolean;
  events: HeartbeatEvent[];
  countries: string[];
  tournaments: Record<string, string[]>;
  lastUpdate: number;
}

// In-memory storage for market availability history
const marketHistories: MarketHistory[] = [];

// Initialize heartbeat state
let heartbeatState: HeartbeatState = {
  isRunning: false,
  events: [],
  countries: [],
  tournaments: {},
  lastUpdate: 0
};

// Get the directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Make sure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  const historyDir = path.join(dataDir, 'heartbeat-history');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  
  return historyDir;
}

// Tracker state
let trackerInterval: NodeJS.Timeout | null = null;
let isTrackerRunning = false;

// Start tracking live events
export function startHeartbeatTracker(url: string, storage: IStorage): void {
  if (isTrackerRunning) {
    console.log("Heartbeat tracker is already running");
    return;
  }
  
  heartbeatState.isRunning = true;
  isTrackerRunning = true;
  
  // Immediately run once
  runHeartbeatTracker(url, storage);
  
  // Then set up interval (every 20 seconds)
  trackerInterval = setInterval(() => {
    console.log("Running heartbeat tracker cycle");
    runHeartbeatTracker(url, storage);
  }, 20000); // 20 seconds
  
  // Load historical data on startup
  loadHistoryData();
}

// Stop tracking live events
export function stopHeartbeatTracker(): void {
  if (trackerInterval) {
    clearInterval(trackerInterval);
    trackerInterval = null;
  }
  
  heartbeatState.isRunning = false;
  isTrackerRunning = false;
  
  // Save history data when stopping
  saveHistoryData();
}

// Main tracker function
async function runHeartbeatTracker(url: string, storage: IStorage): Promise<void> {
  try {
    // Update last update timestamp
    heartbeatState.lastUpdate = Date.now();
    
    // Set up promisify for exec
    const execPromise = promisify(exec);
    
    // Try the direct Node.js implementation first (from Python script approach)
    console.log('Trying direct implementation based on Python script...');
    let events: any[] = [];
    
    // Run our direct implementation that uses the direct approach from the Python script
    try {
      const scriptPath = path.resolve(process.cwd(), 'server/scrapers/custom/betpawa_direct.cjs');
      console.log(`Running script: ${scriptPath}`);
      
      const { stdout, stderr } = await execPromise(`node ${scriptPath}`);
      
      if (stderr) {
        console.error('Error from direct script:', stderr);
      }
      
      if (stdout && stdout.trim()) {
        try {
          const directEvents = JSON.parse(stdout);
          
          if (Array.isArray(directEvents) && directEvents.length > 0) {
            console.log(`Direct script returned ${directEvents.length} events from BetPawa`);
            
            // Convert events to our format
            events = directEvents.map((event: any) => {
              const homeTeam = event.homeTeam || (event.event ? event.event.split(' vs ')[0] : '');
              const awayTeam = event.awayTeam || (event.event ? event.event.split(' vs ')[1] : '');
              
              // IMPORTANT: Base the currentlyAvailable ONLY on totalMarketCount for consistency
              // Event is only suspended when totalMarketCount = 0
              const isSuspended = event.totalMarketCount === 0;
              
              // Log resuming events for debugging
              if (event.suspended && !isSuspended) {
                console.log(`🟢 RESUMED EVENT: ${event.eventId} has totalMarketCount=${event.totalMarketCount || 'N/A'}`);
              }
              
              return {
                id: event.eventId || '',
                name: event.event || `${homeTeam} vs ${awayTeam}`,
                homeTeam,
                awayTeam,
                country: event.country || 'Unknown',
                tournament: event.tournament || 'Unknown',
                isInPlay: true,
                startTime: event.start_time || new Date().toISOString(),
                currentlyAvailable: !isSuspended,
                marketAvailability: isSuspended ? 'SUSPENDED' : 'ACTIVE',
                suspended: isSuspended, // Explicit suspended property that matches totalMarketCount = 0
                gameMinute: event.gameMinute || '1',
                recordCount: 1,
                widgetId: event.eventId || '',
                totalMarketCount: event.totalMarketCount || 0 // Store the actual market count for better tracking
              };
            });
          }
        } catch (error) {
          console.error('Error parsing direct script output:', error);
        }
      }
    } catch (error) {
      console.error('Error running direct script:', error);
    }
    
    // If the direct implementation didn't work, try our API approach
    if (events.length === 0) {
      // Import our specialized betpawa API module using dynamic import (ES modules)
      const betpawaApi = await import('./betpawa_live_api');
      const { fetchBetPawaLiveEvents, fetchBetPawaFootballLive, parseEventsForHeartbeat } = betpawaApi;
      
      // Try to get events using our specialized API functions
      console.log('Using specialized BetPawa API module...');
      
      // Try the main implementation first
      events = await fetchBetPawaLiveEvents();
      
      // If no events, try the football endpoint
      if (events.length === 0) {
        console.log('No events from main endpoint, trying football endpoint...');
        const footballData = await fetchBetPawaFootballLive();
        
        if (footballData) {
          // Parse the football data according to its structure
          if (Array.isArray(footballData)) {
            events = footballData;
          } else if (footballData.events && Array.isArray(footballData.events)) {
            events = footballData.events;
          }
        }
      }
      
      // If still no events, fall back to the original scraper
      if (events.length === 0) {
        console.log('No events from specialized API, falling back to original scraper...');
        events = await scrapeEvents(url);
        
        // Try betpawa Kenya as a fallback
        if (events.length === 0) {
          console.log('Trying betpawa Kenya as a fallback for live events...');
          const kenyaUrl = 'https://www.betpawa.co.ke/api/sportsbook/events/live/football?_=' + Date.now();
          
          try {
            console.log(`Making request to Kenya endpoint: ${kenyaUrl}`);
            const headers = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.betpawa.co.ke/',
              'Origin': 'https://www.betpawa.co.ke',
              'Connection': 'keep-alive',
              'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"Windows"',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-origin',
              'x-pawa-brand': 'betpawa-kenya'
            };
            
            const response = await axios.get(kenyaUrl, { headers, timeout: 30000 });
            if (response.status === 200 && response.data) {
              console.log('Kenya endpoint returned data:', Object.keys(response.data));
              if (Array.isArray(response.data)) {
                events = response.data;
                console.log(`Found ${events.length} events from Kenya endpoint`);
              }
            }
          } catch (error: any) {
            console.error('Error fetching from Kenya endpoint:', error.message);
          }
        }
        
        // Try a third option that worked previously
        if (events.length === 0) {
          console.log('Trying third option endpoint that worked in the past');
          
          // This is a hardcoded URL that we know worked in the past
          const thirdUrl = 'https://www.sportybet.com/api/ng/factsCenter/schedule/inPlay?sportId=1&dateTime=202504261419';
          
          try {
            console.log(`Making request to third fallback endpoint: ${thirdUrl}`);
            const headers = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.sportybet.com/',
              'Origin': 'https://www.sportybet.com',
              'Connection': 'keep-alive'
            };
            
            const response = await axios.get(thirdUrl, { headers, timeout: 30000 });
            if (response.status === 200 && response.data) {
              console.log('Third endpoint returned data with keys:', Object.keys(response.data));
              
              if (response.data.data && Array.isArray(response.data.data)) {
                const sportybetEvents = response.data.data;
                console.log(`Found ${sportybetEvents.length} events from Sportybet`);
                
                // Convert Sportybet format to our expected format
                events = sportybetEvents.map((event: any) => {
                  try {
                    // Extract teams 
                    const homeTeam = event.homeName || event.competitors?.[0]?.name || "";
                    const awayTeam = event.awayName || event.competitors?.[1]?.name || "";
                    
                    // Create a synthetic BetPawa-like structure
                    return {
                      id: event.id.toString(),
                      name: event.name || `${homeTeam} vs ${awayTeam}`,
                      homeTeam: homeTeam,
                      awayTeam: awayTeam,
                      scoreboard: {
                        display: {
                          minute: event.matchTime || "1"
                        }
                      },
                      markets: [
                        {
                          suspended: event.suspended || false,
                          type: "1X2",
                          typeId: "3743",
                          prices: [
                            { name: "1", suspended: event.suspended || false, price: "2.00" },
                            { name: "X", suspended: event.suspended || false, price: "3.40" },
                            { name: "2", suspended: event.suspended || false, price: "3.50" }
                          ]
                        }
                      ],
                      category: {
                        name: event.country || event.category || "International"
                      },
                      tournament: {
                        name: event.league || event.tournament || "League"
                      },
                      startTime: event.startTime || new Date().toISOString()
                    };
                  } catch (e) {
                    console.error('Error mapping Sportybet event:', e);
                    return null;
                  }
                }).filter(Boolean); // Remove any nulls
              }
            }
          } catch (error: any) {
            console.error('Error fetching from third endpoint:', error.message);
          }
        }
      }
    }
    
    console.log(`Total events collected: ${events.length}`);
    
    // Process the events
    await processEvents(events);
    
    // Save the market history data periodically
    await saveHistoryData();
    
    // Clean up old data
    cleanupOldData();
    
    // Emit a heartbeat event
    heartbeatEvents.emit(HEARTBEAT_EVENTS.HEARTBEAT, {
      timestamp: Date.now(),
      eventCount: events.length
    });
  } catch (error) {
    console.error('Error in heartbeat tracker:', error);
  }
}

// Generate mock events for testing
function generateMockEvents(): any[] {
  const mockEvents = [];
  
  // Real team names for more realistic data
  const realTeams = [
    { home: "Arsenal", away: "Chelsea", country: "England", tournament: "Premier League" },
    { home: "Manchester United", away: "Liverpool", country: "England", tournament: "Premier League" },
    { home: "Real Madrid", away: "Barcelona", country: "Spain", tournament: "La Liga" },
    { home: "Bayern Munich", away: "Borussia Dortmund", country: "Germany", tournament: "Bundesliga" },
    { home: "PSG", away: "Marseille", country: "France", tournament: "Ligue 1" },
    { home: "Inter Milan", away: "AC Milan", country: "Italy", tournament: "Serie A" },
    { home: "Benfica", away: "Porto", country: "Portugal", tournament: "Primeira Liga" },
    { home: "Ajax", away: "PSV", country: "Netherlands", tournament: "Eredivisie" },
    { home: "Celtic", away: "Rangers", country: "Scotland", tournament: "Scottish Premiership" },
    { home: "Boca Juniors", away: "River Plate", country: "Argentina", tournament: "Primera División" },
    { home: "Flamengo", away: "Corinthians", country: "Brazil", tournament: "Brasileirão" },
    { home: "Al Ahly", away: "Zamalek", country: "Egypt", tournament: "Egyptian Premier League" },
    { home: "Galatasaray", away: "Fenerbahçe", country: "Turkey", tournament: "Süper Lig" },
    { home: "Kaizer Chiefs", away: "Orlando Pirates", country: "South Africa", tournament: "Premier Soccer League" },
    { home: "Gor Mahia", away: "AFC Leopards", country: "Kenya", tournament: "Kenyan Premier League" },
    { home: "Hearts of Oak", away: "Asante Kotoko", country: "Ghana", tournament: "Ghana Premier League" },
    { home: "Dukla Prague", away: "Sparta Prague", country: "Czech Republic", tournament: "Czech First League" }
  ];
  
  // Generate 3-6 random events
  const eventCount = 3 + Math.floor(Math.random() * 4);
  
  // Random minute generator
  function getRandomGameMinute() {
    const rand = Math.random();
    if (rand < 0.1) return "HT"; // 10% chance of halftime
    if (rand < 0.15) return "45+2"; // 5% chance of first half added time
    if (rand < 0.2) return "90+3"; // 5% chance of second half added time
    return Math.max(1, Math.floor(Math.random() * 90)).toString(); // Regular minute
  }
  
  // Random price generator
  function getRandomPrice(min: number, max: number) {
    return (min + Math.random() * (max - min)).toFixed(2);
  }
  
  // Iterate and create events
  for (let i = 0; i < eventCount; i++) {
    const eventId = `${26987200 + i}`;
    const teamPair = realTeams[Math.floor(Math.random() * realTeams.length)];
    const homeTeam = teamPair.home;
    const awayTeam = teamPair.away;
    const suspended = Math.random() > 0.7; // 30% chance of being suspended
    const minute = getRandomGameMinute();
    
    // Add some dynamic odds rather than static ones
    const homeOdds = getRandomPrice(1.5, 4.5);
    const drawOdds = getRandomPrice(2.8, 4.2);
    const awayOdds = getRandomPrice(1.5, 6.5);
    
    mockEvents.push({
      id: eventId,
      name: `${homeTeam} vs ${awayTeam}`,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      scoreboard: {
        display: {
          minute: minute
        }
      },
      markets: [
        {
          suspended: suspended,
          type: "1X2",
          typeId: "3743",
          prices: [
            { name: "1", suspended: suspended, price: homeOdds },
            { name: "X", suspended: suspended, price: drawOdds },
            { name: "2", suspended: suspended, price: awayOdds }
          ]
        }
      ],
      category: {
        name: teamPair.country
      },
      tournament: {
        name: teamPair.tournament
      },
      startTime: new Date().toISOString()
    });
  }
  
  // Dukla Prague vs Sparta Prague, a great fixture for testing
  // Use a fixed ID so we can always find it
  const duklaIndex = realTeams.findIndex(team => team.home === "Dukla Prague");
  if (duklaIndex >= 0) {
    const dukla = realTeams[duklaIndex];
    
    // This is the event from the attached file in the assets
    mockEvents.push({
      id: "26987192",
      name: `${dukla.home} vs ${dukla.away}`,
      homeTeam: dukla.home,
      awayTeam: dukla.away,
      scoreboard: {
        display: {
          minute: "63"
        }
      },
      markets: [
        {
          suspended: false, // Always available for demo purposes
          type: "1X2",
          typeId: "3743",
          prices: [
            { name: "1", suspended: false, price: "3.25" },
            { name: "X", suspended: false, price: "3.40" },
            { name: "2", suspended: false, price: "2.10" }
          ]
        }
      ],
      category: {
        name: dukla.country
      },
      tournament: {
        name: dukla.tournament
      },
      startTime: new Date().toISOString()
    });
  }
  
  return mockEvents;
}

// Build the API URL with parameters
function buildApiUrl(host: string, path: string, params: Record<string, any> = {}): string {
  const url = new URL(path, host);
  
  // Add each parameter to the URL
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value.toString());
  });
  
  return url.toString();
}

// Scrape events from the API
async function scrapeEvents(apiUrl: string): Promise<any[]> {
  try {
    let url = apiUrl;
    let headers: Record<string, string> = {};
    const isBetPawa = url.includes('betpawa');
    
    // If this is BetPawa, use custom API format with specific query structure
    if (isBetPawa) {
      console.log("Using BetPawa-specific configuration");
      
      // Extract domain and country code from URL
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const brand = domain.includes('ghana') ? 'ghana' : (domain.includes('kenya') ? 'kenya' : 'uganda');
      
      // Set up the URL with appropriate query parameters
      const timestamp = Date.now();
      const queries = JSON.stringify({
        query: { eventType: "LIVE", categories: [2], zones: {} },
        view: { marketTypes: ["3743"] },
        skip: 0,
        sort: { "competitionPriority": "DESC" },
        take: 20
      });
      
      // Use the encoded query format that is known to work
      const encodedQuery = encodeURIComponent(JSON.stringify({ queries: [queries] }));
      url = `https://${domain}/api/sportsbook/v2/events/lists/by-queries?q=${encodedQuery}`;
      
      console.log(`Scraping using URL: ${url}`);
      console.log(`Making request to: ${url}`);
      
      // Set up headers and cookies for request
      headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://${domain}/`,
        'Origin': `https://${domain}`,
        'Connection': 'keep-alive',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'x-pawa-brand': `betpawa-${brand}`,
        'x-pawa-language': 'en',
        // Cookies in header format
        'cookie': '_ga=GA1.1.459857438.1713161475; _ga_608WPEPCC3=GS1.1.1731480684.7.0.1731480684.0.0.0; aff_cookie=F60; _gcl_au=1.1.1725251410.1738666716; PHPSESSID=b0694dabe05179bc223abcdf8f7bf83e; tracingId=0f5927de-e30d-4228-b29c-c92210017a62; x-pawa-token=b4c6eda2ae319f4b-8a3075ba3c9d9984'
      };
      
      console.log(`Using headers with cookie length: ${headers.cookie.length} chars`);
      
      // Make the request
      const response = await axios.get(url, { headers, timeout: 30000 });
      
      // Process the response
      if (response.status === 200) {
        const data = response.data;
        
        console.log('API response structure:', Object.keys(data));
        
        // Extract events from the response
        if (data.responses && Array.isArray(data.responses)) {
          console.log('Responses structure found');
          
          // Look for events in the response structure
          let events: any[] = [];
          
          // Try to extract events from various structures
          for (const resp of data.responses) {
            if (resp.events && Array.isArray(resp.events)) {
              events.push(...resp.events);
            } else if (resp.responses && Array.isArray(resp.responses)) {
              events = resp.responses;
            }
          }
          
          console.log(`Scraped ${events.length} events from BetPawa API (responses format)`);
          return events;
        } else {
          console.log('No responses structure found in API response');
          return [];
        }
      } else {
        console.error(`HTTP error ${response.status} from BetPawa API`);
        return [];
      }
    } else {
      console.log(`Making simple request to non-BetPawa URL: ${apiUrl}`);
      
      // For non-BetPawa endpoints, use a simple request
      const response = await axios.get(apiUrl, { timeout: 15000 });
      
      if (response.status === 200) {
        if (Array.isArray(response.data)) {
          return response.data;
        } else if (response.data.events && Array.isArray(response.data.events)) {
          return response.data.events;
        } else {
          console.log('Response structure not recognized');
          return [];
        }
      } else {
        console.error(`HTTP error ${response.status} from API`);
        return [];
      }
    }
  } catch (error: any) {
    console.error('Error in scrapeEvents:', error.message);
    return [];
  }
}

// Process events and update the tracking state
async function processEvents(events: any[]): Promise<void> {
  if (events.length === 0) {
    console.log('No events to process - returning early');
    return;
  }
  
  try {
    // Convert the events into our standard format
    const normalizedEvents: HeartbeatEvent[] = events.map(event => {
      // Try to extract name and teams
      let name = event.name || '';
      let homeTeam = event.homeTeam || '';
      let awayTeam = event.awayTeam || '';
      
      // If name contains vs but we don't have homeTeam and awayTeam, extract them
      if (name.includes(' vs ') && (!homeTeam || !awayTeam)) {
        const parts = name.split(' vs ');
        homeTeam = parts[0].trim();
        awayTeam = parts[1].trim();
      }
      
      // IMPORTANT: Determine if the market is available based ONLY on totalMarketCount
      // Events should ONLY be suspended when totalMarketCount = 0, and automatically
      // return to available state when markets return
      let isAvailable = true;
      let marketStatus = 'ACTIVE';
      
      // Check ONLY totalMarketCount=0 which is the most reliable indicator
      if (event.totalMarketCount === 0) {
        isAvailable = false;
        marketStatus = 'SUSPENDED';
        console.log(`🚨 EVENT SUSPENDED: ${event.id || event.eventId} (${event.name || 'Unknown'}) - totalMarketCount=0`);
        
        // Output detailed debug information
        console.log(`EVENT SUSPENDED DETAILS: ${JSON.stringify({
          id: event.id || event.eventId,
          name: event.name || event.event,
          homeTeam: event.homeTeam || (event.name ? event.name.split(" vs ")[0] : "Unknown"),
          awayTeam: event.awayTeam || (event.name ? event.name.split(" vs ")[1] : "Unknown"),
          totalMarketCount: 0,
          suspended: true
        }, null, 2)}`);
      } else {
        // If totalMarketCount > 0, ensure event is marked as available
        // Explicitly log any events that were previously suspended but now available
        const eventId = event.id || event.eventId;
        const existingEvent = heartbeatState.events.find(e => e.id === eventId);
        
        if (existingEvent && !existingEvent.currentlyAvailable) {
          console.log(`🟢 EVENT RESUMED: ${eventId} (${event.name || 'Unknown'}) - totalMarketCount=${event.totalMarketCount}`);
          console.log(`EVENT RESUMED DETAILS: Previously suspended event now has totalMarketCount=${event.totalMarketCount}`);
        }
        
        // Ensure available status is set correctly
        isAvailable = true;
        marketStatus = 'ACTIVE';
      }
      
      // Extract gameMinute from different possible structures
      let gameMinute = '1';
      
      if (event.scoreboard?.display?.minute) {
        gameMinute = event.scoreboard.display.minute;
      } else if (event.gameMinute) {
        gameMinute = event.gameMinute;
      } else if (event.matchTime) {
        gameMinute = event.matchTime.toString();
      }
      
      // Extract country and tournament from different possible structures
      let country = 'International';
      let tournament = 'Unknown';
      
      if (event.country) {
        country = event.country;
      } else if (event.category?.name) {
        country = event.category.name;
      } else if (event.region?.name) {
        country = event.region.name;
      }
      
      if (event.tournament) {
        tournament = event.tournament;
      } else if (event.tournament?.name) {
        tournament = event.tournament.name;
      } else if (event.competition?.name) {
        tournament = event.competition.name;
      }
      
      // Create a standardized event object with explicit totalMarketCount
      return {
        id: event.id?.toString() || event.eventId?.toString() || '',
        name: name,
        country: country,
        tournament: tournament,
        isInPlay: true,
        startTime: event.startTime || new Date().toISOString(),
        currentlyAvailable: isAvailable,
        marketAvailability: marketStatus,
        suspended: !isAvailable, // Add explicit suspended property that matches !currentlyAvailable
        recordCount: 1,
        gameMinute: gameMinute,
        widgetId: event.widgetId || event.id?.toString() || '',
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        totalMarketCount: event.totalMarketCount || 0 // CRITICAL: Make sure totalMarketCount is passed through!
      };
      
      // Debug the raw event data to see where the totalMarketCount is coming from
      if (event.id?.toString() === "56525701" || event.eventId?.toString() === "56525701") {
        console.log("DEBUG RAW EVENT STRUCTURE:", JSON.stringify(event, null, 2));
      }
    });
    
    // Update the heartbeat state with the new events
    // CRITICAL FIX: Don't replace all events, as this would remove events that are suspended
    // and not returned by the API. Instead, update existing events and add new ones.
    
    // First, identify which events we already have in our state
    const existingEventIds = new Set(heartbeatState.events.map(e => e.id));
    
    // Create a map of the new events
    const newEventsMap = new Map(normalizedEvents.map(e => [e.id, e]));
    
    // Update the heartbeat state by:
    // 1. Keeping existing events that are not in the new set (these are suspended events no longer returned by API)
    // 2. Updating events that exist in both sets (prefer new data but keep suspension state if needed)
    // 3. Adding events that are in the new set but not in the existing set
    
    // Debugging counts
    console.log(`PROCESSING: ${heartbeatState.events.length} events in current state, ${normalizedEvents.length} events in new API response`);
    
    // Keep track of suspended events for debugging
    const existingSuspendedEvents = heartbeatState.events.filter(e => e.suspended === true || e.currentlyAvailable === false);
    console.log(`PROCESSING: ${existingSuspendedEvents.length} suspended events in current state before update`);
    
    // Create the updated events array
    const updatedEvents = [];
    
    // First, add all existing events that aren't in the new set (likely suspended events)
    for (const existingEvent of heartbeatState.events) {
      if (!newEventsMap.has(existingEvent.id)) {
        // This event wasn't returned by the API, so it's likely suspended
        // Keep it in our state with suspended=true
        if (!existingEvent.suspended) {
          console.log(`DEBUG: Marking event ${existingEvent.id} (${existingEvent.name}) as suspended because it's no longer in API response`);
          existingEvent.suspended = true;
          existingEvent.currentlyAvailable = false;
        }
        
        // Mark the last time we saw this event
        existingEvent.lastSeen = existingEvent.lastSeen || Date.now();
        
        // Only consider an event finished if we haven't seen it for more than 6 hours
        const sixHoursMs = 6 * 60 * 60 * 1000;
        if (Date.now() - existingEvent.lastSeen > sixHoursMs) {
          existingEvent.finished = true;
          console.log(`📆 Marking event ${existingEvent.id} (${existingEvent.name}) as FINISHED - not seen for over 6 hours`);
        }
        
        updatedEvents.push(existingEvent);
      }
    }
    
    // Then add all events from the new response
    for (const newEvent of normalizedEvents) {
      // Check if this event exists in our current state
      const existingEvent = heartbeatState.events.find(e => e.id === newEvent.id);
      
      if (existingEvent) {
        // COMPLETELY SIMPLIFIED: ONLY check totalMarketCount
        // Don't look at any other flag
        if (newEvent.totalMarketCount && newEvent.totalMarketCount > 0) {
          // EVENT HAS MARKETS, ALWAYS MARK AS AVAILABLE
          if (existingEvent.suspended) {
            console.log(`🟢 MARKET RESUMED: Event ${newEvent.id} (${newEvent.name}) now has ${newEvent.totalMarketCount} markets available. FORCING AVAILABLE STATE.`);
          }
          newEvent.suspended = false;
          newEvent.currentlyAvailable = true;
          
          // Event is seen again, clear any finished status
          newEvent.finished = false;
          
          // Update last seen timestamp
          newEvent.lastSeen = Date.now();
        } else {
          // No markets, ALWAYS mark as suspended
          if (!existingEvent.suspended) {
            console.log(`🚨 MARKET SUSPENDED: Event ${newEvent.id} (${newEvent.name}) has no markets available. FORCING SUSPENDED STATE.`);
          }
          newEvent.suspended = true;
          newEvent.currentlyAvailable = false;
          
          // Update last seen timestamp
          newEvent.lastSeen = Date.now();
        }
      } else {
        // This is a newly discovered event
        // Make sure it has the lastSeen timestamp
        newEvent.lastSeen = Date.now();
        
        // And it's definitely not finished
        newEvent.finished = false;
        
        console.log(`📌 NEW EVENT DISCOVERED: ${newEvent.id} (${newEvent.name}) - totalMarketCount=${newEvent.totalMarketCount || 0}`);
      }
      
      updatedEvents.push(newEvent);
    }
    
    // Debug final count
    const finalSuspendedEvents = updatedEvents.filter(e => e.suspended === true || e.currentlyAvailable === false);
    console.log(`PROCESSING: ${updatedEvents.length} total events after update, ${finalSuspendedEvents.length} suspended`);
    
    // If we lost any suspended events, log a warning
    if (finalSuspendedEvents.length < existingSuspendedEvents.length) {
      console.warn(`WARNING: Lost ${existingSuspendedEvents.length - finalSuspendedEvents.length} suspended events during update!`);
    }
    
    // Update the state
    heartbeatState.events = updatedEvents;
    
    // Extract countries and tournaments for filtering
    // Use ALL events, including suspended ones, for countries and tournaments
    const countries = new Set<string>();
    const tournaments: Record<string, string[]> = {};
    
    // Use the updatedEvents array which now includes both new events and retained suspended events
    for (const event of heartbeatState.events) {
      if (event.country) {
        countries.add(event.country);
        
        // Add tournament under this country
        if (event.tournament) {
          if (!tournaments[event.country]) {
            tournaments[event.country] = [];
          }
          
          if (!tournaments[event.country].includes(event.tournament)) {
            tournaments[event.country].push(event.tournament);
          }
        }
      }
    }
    
    // Update the heartbeat state
    heartbeatState.countries = Array.from(countries).sort();
    heartbeatState.tournaments = tournaments;
    
    // Update market history for ALL events, including suspended ones
    // This ensures we continue to track suspended events in the history
    for (const event of heartbeatState.events) {
      updateMarketHistory(event);
    }
    
    // Emit a status update event
    heartbeatEvents.emit(HEARTBEAT_EVENTS.STATUS_UPDATED, heartbeatState);
  } catch (error) {
    console.error('Error processing events:', error);
  }
}

// Update market history for an event
function updateMarketHistory(event: HeartbeatEvent): void {
  const eventId = event.id;
  if (!eventId) return;
  
  // Find existing history or create a new one
  let history = marketHistories.find(h => h.eventId === eventId);
  
  if (!history) {
    history = {
      eventId,
      timestamps: []
    };
    marketHistories.push(history);
  }
  
  // Add the current timestamp with more detailed information
  const timestamp = Date.now();
  const isAvailable = !!event.currentlyAvailable; // Double-bang to ensure it's always a boolean
  
  // Create detailed tracking data point
  history.timestamps.push({
    timestamp: timestamp,
    isAvailable: isAvailable, // Force to boolean type
    marketStatus: event.marketAvailability || (isAvailable ? 'ACTIVE' : 'SUSPENDED'), // Include the exact market status for better debugging
    gameMinute: event.gameMinute || '1' // Include game minute in each timestamp
  });
  
  // Debug log for suspended events to ensure they're properly tracked
  if (!isAvailable) {
    console.log(`⚠️ TRACKING SUSPENDED MARKET EVENT ${event.id}: ${event.name}`);
    console.log(`  - Market status: ${event.marketAvailability}`);
    console.log(`  - Stored isAvailable=${isAvailable}`);
  }
  
  // Log timestamp data for debugging when market is not available
  if (!event.currentlyAvailable) {
    console.log(`Added suspended market data point for event ${event.id} at timestamp ${new Date(timestamp).toISOString()}`);
  }
  
  // Limit history size to avoid memory issues (keep last 1000 points per event)
  if (history.timestamps.length > 1000) {
    history.timestamps = history.timestamps.slice(-1000);
  }
}

// Get all event histories
export function getAllEventHistories(): any[] {
  return marketHistories.map(history => {
    // Calculate statistics for this event
    const totalPoints = history.timestamps.length;
    const availablePoints = history.timestamps.filter(t => t.isAvailable).length;
    const uptimePercentage = totalPoints > 0 ? (availablePoints / totalPoints) * 100 : 0;
    
    // Return the history with statistics
    return {
      eventId: history.eventId,
      timestamps: history.timestamps,
      statistics: {
        totalPoints,
        availablePoints,
        uptimePercentage: Math.round(uptimePercentage * 10) / 10 // Round to 1 decimal place
      }
    };
  });
}

// Get market history for a specific event
export function getEventMarketHistory(eventId: string): { 
  timestamps: { timestamp: number; isAvailable: boolean; marketStatus?: string; gameMinute?: string }[]; 
  statistics: { totalPoints: number; availablePoints: number; uptimePercentage: number }
} {
  // Find the history for this event
  const history = marketHistories.find(h => h.eventId === eventId);
  
  if (!history) {
    return {
      timestamps: [],
      statistics: {
        totalPoints: 0,
        availablePoints: 0,
        uptimePercentage: 0
      }
    };
  }
  
  // Calculate statistics
  const totalPoints = history.timestamps.length;
  const availablePoints = history.timestamps.filter(t => t.isAvailable).length;
  const uptimePercentage = totalPoints > 0 ? (availablePoints / totalPoints) * 100 : 0;
  
  // Return the history with statistics
  return {
    timestamps: history.timestamps,
    statistics: {
      totalPoints,
      availablePoints,
      uptimePercentage: Math.round(uptimePercentage * 10) / 10 // Round to 1 decimal place
    }
  };
}

// Get the current heartbeat status
export function getHeartbeatStatus(): HeartbeatState {
  // Debug suspensions
  const suspendedEvents = heartbeatState.events.filter(e => (!e.currentlyAvailable || e.suspended) && !e.finished);
  if (suspendedEvents.length > 0) {
    console.log(`BACKEND DEBUG: Found ${suspendedEvents.length} suspended events in heartbeatState. Total events: ${heartbeatState.events.length}`);
    suspendedEvents.forEach(e => {
      console.log(`BACKEND DEBUG: Suspended event: ${e.id} (${e.name}) - currentlyAvailable: ${e.currentlyAvailable}, suspended: ${e.suspended}, finished: ${e.finished || false}`);
    });
  }
  
  // Create a new state object with the correct data
  // Filter out finished events from the API response
  const filteredEvents = heartbeatState.events.filter(event => !event.finished);
  
  return {
    ...heartbeatState,
    events: filteredEvents // Return everything except finished events
  };
}

// Save history data to disk
async function saveHistoryData(): Promise<void> {
  try {
    const dataDir = await ensureDataDirectory();
    const filePath = path.join(dataDir, 'market-history.json');
    
    // Save the history data
    fs.writeFileSync(filePath, JSON.stringify(marketHistories));
    
    console.log('Saved heartbeat history data');
  } catch (error) {
    console.error('Error saving history data:', error);
  }
}

// Load history data from disk
async function loadHistoryData(): Promise<void> {
  try {
    const dataDir = await ensureDataDirectory();
    const filePath = path.join(dataDir, 'market-history.json');
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const histories = JSON.parse(data) as MarketHistory[];
      
      // Replace current histories with loaded ones
      marketHistories.length = 0;
      marketHistories.push(...histories);
      
      console.log(`Loaded ${histories.length} event histories from disk`);
    }
  } catch (error) {
    console.error('Error loading history data:', error);
  }
}

// Clean up old data to save memory/disk space
function cleanupOldData(): void {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000; // 1 day in milliseconds
  
  // Before cleaning up, make a list of all suspended events to preserve them
  const suspendedEventIds = heartbeatState.events
    .filter(e => !e.currentlyAvailable || e.suspended)
    .map(e => e.id);
  
  if (suspendedEventIds.length > 0) {
    console.log(`CLEANUP: Found ${suspendedEventIds.length} suspended events to preserve:`);
    console.log(suspendedEventIds);
  }
  
  // For each history, remove points older than 24 hours
  for (const history of marketHistories) {
    // Keep more history for suspended events (3 days instead of 1)
    const keepDuration = suspendedEventIds.includes(history.eventId) 
      ? 3 * oneDay  // 3 days for suspended events
      : oneDay;     // 1 day for normal events
    
    history.timestamps = history.timestamps.filter(t => now - t.timestamp < keepDuration);
  }
  
  // Remove histories with no data points, but ALWAYS keep suspended event histories
  const initialCount = marketHistories.length;
  const filteredHistories = marketHistories.filter(h => {
    // Keep if it has timestamps OR is a suspended event
    return h.timestamps.length > 0 || suspendedEventIds.includes(h.eventId);
  });
  
  if (filteredHistories.length < initialCount) {
    console.log(`Removed ${initialCount - filteredHistories.length} empty histories`);
    marketHistories.length = 0;
    marketHistories.push(...filteredHistories);
  }
}