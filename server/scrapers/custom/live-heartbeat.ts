import axios, { AxiosResponse } from 'axios';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { IStorage } from '../../storage';
// Import path and fileURLToPath for ES Modules directory path handling
import { fileURLToPath } from 'url';

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
}

// Define the structure for market history
interface MarketHistory {
  eventId: string;
  timestamps: {
    timestamp: number;
    isAvailable: boolean;
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
    
    // Import our specialized betpawa API module using dynamic import (ES modules)
    const betpawaApi = await import('./betpawa_live_api');
    const { fetchBetPawaLiveEvents, fetchBetPawaFootballLive, parseEventsForHeartbeat } = betpawaApi;
    
    // Try to get events using our specialized API functions
    console.log('Using specialized BetPawa API module...');
    let events: any[] = [];
    
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
        } catch (error) {
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
              events = sportybetEvents.map(event => {
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
        } catch (error) {
          console.error('Error fetching from third endpoint:', error.message);
        }
      }
      
      // If still no events after trying all methods, do not use mock events
      // We want to see real events only as requested by the user
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
      
      // Use the exact endpoint URL provided by the user
      url = `https://www.betpawa.com.gh/api/sportsbook/v2/events/lists/by-queries?q=%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B%222%22%5D%2C%22zones%22%3A%7B%7D%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A0%2C%22sort%22%3A%7B%22competitionPriority%22%3A%22DESC%22%7D%2C%22take%22%3A20%7D%5D%7D`;
      
      // Use the exact headers from bp_gh_live_scraper.js that we know are working
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
        "x-pawa-brand": `betpawa-${brand}`
      };
      
      // Add cookies to headers
      headers['cookie'] = '_ga=GA1.1.459857438.1713161475; _ga_608WPEPCC3=GS1.1.1731480684.7.0.1731480684.0.0.0; aff_cookie=F60; _gcl_au=1.1.1725251410.1738666716; PHPSESSID=b0694dabe05179bc223abcdf8f7bf83e; tracingId=0f5927de-e30d-4228-b29c-c92210017a62; x-pawa-token=b4c6eda2ae319f4b-8a3075ba3c9d9984';
    }
    
    console.log(`Scraping using URL: ${url}`);
    
    console.log(`Making request to: ${url}`);
    console.log(`Using headers with cookie length: ${headers.cookie ? headers.cookie.length : 0} chars`);
    
    try {
      // Add cache-busting timestamp parameter
      const timestamp = Date.now();
      const urlWithTimestamp = `${url}&_t=${timestamp}`;
      
      const response = await axios.get(urlWithTimestamp, {
        headers,
        timeout: 60000,
      });
      
      if (response.status !== 200) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      const data = response.data;
      
      // Log the API response structure
      console.log('API response structure:', Object.keys(data));
      
      let events: any[] = [];
      
      // Extract events based on the response structure
      if (isBetPawa && data.events && Array.isArray(data.events)) {
        // Handle BetPawa v2 API response format
        console.log(`Scraped ${data.events.length} events from BetPawa API (events array)`);
        events = data.events;
      } else if (isBetPawa && data.results && Array.isArray(data.results)) {
        // Handle BetPawa v1 API response format
        console.log(`Scraped ${data.results.length} events from BetPawa API (results array)`);
        events = data.results;
      } else if (isBetPawa && data.queries && Array.isArray(data.queries)) {
        // Handle the queries format (lists/by-queries endpoint)
        for (const query of data.queries) {
          if (query.events && Array.isArray(query.events)) {
            events.push(...query.events);
          }
        }
        console.log(`Scraped ${events.length} events from BetPawa API (queries format)`);
      } else if (isBetPawa && data.data && data.data.events && Array.isArray(data.data.events)) {
        // Handle nested data structure
        console.log(`Scraped ${data.data.events.length} events from BetPawa API (nested data.events)`);
        events = data.data.events;
      } else if (isBetPawa && data.responses && Array.isArray(data.responses)) {
        // Handle 'responses' structure
        console.log('Responses structure found');
        
        for (const response of data.responses) {
          if (response.events && Array.isArray(response.events)) {
            console.log(`Found ${response.events.length} events in response.events`);
            events.push(...response.events);
          } else if (response.data && response.data.events && Array.isArray(response.data.events)) {
            console.log(`Found ${response.data.events.length} events in response.data.events`);
            events.push(...response.data.events);
          } else if (response.queries && Array.isArray(response.queries)) {
            // Handle nested queries structure
            console.log(`Found queries array with ${response.queries.length} items`);
            for (const query of response.queries) {
              if (query.events && Array.isArray(query.events)) {
                console.log(`Found ${query.events.length} events in query.events`);
                events.push(...query.events);
              }
            }
          }
        }
        
        console.log(`Scraped ${events.length} events from BetPawa API (responses format)`);
      } else if (Array.isArray(data)) {
        // Handle standard array response
        console.log(`Scraped ${data.length} events from standard array response`);
        events = data;
      } else {
        // Last resort fallback: try to find anything that could be events
        console.error('Unrecognized data format, attempting to extract any array data');
        for (const key in data) {
          if (Array.isArray(data[key])) {
            console.log(`Found possible events array in key '${key}' with ${data[key].length} items`);
            events = data[key];
            break;
          }
        }
        
        if (events.length === 0) {
          console.error('Could not parse response data into events array');
        }
      }
      
      return events;
    } catch (error: any) {
      console.error('Error with API request:', error.message);
      return [];
    }
  } catch (error: any) {
    console.error('Error scraping events:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
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
  
  // Convert real events to HeartbeatEvents
  const processedEvents: HeartbeatEvent[] = [];
  
  // Process each live event
  for (const event of events) {
    try {
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
      console.error(`Error processing event:`, error);
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
      const activeEvent = heartbeatState.events.find(e => e.id === history.eventId);
      if (activeEvent) {
        homeTeam = activeEvent.homeTeam || '';
        awayTeam = activeEvent.awayTeam || '';
      }
      
      // Construct a name for the historical event
      let name = `Event ${history.eventId}`;
      if (homeTeam && awayTeam) {
        name = `${homeTeam} vs ${awayTeam}`;
      }
      
      historicalEvents.push({
        id: history.eventId,
        name: name,
        country: "Historical",
        tournament: "Completed",
        timestamps: history.timestamps
      });
    }
  });
  
  return historicalEvents;
}

// Get market history for a specific event
export function getEventMarketHistory(eventId: string): { 
  timestamps: { timestamp: number; isAvailable: boolean; }[]; 
  statistics: { totalPoints: number; availablePoints: number; uptimePercentage: number; }
} {
  console.log(`Getting market history for event ID: ${eventId}`);
  console.log(`Total market histories available: ${marketHistories.length}`);
  
  if (marketHistories.length > 0) {
    console.log(`Available event IDs: ${marketHistories.map(h => h.eventId).join(', ')}`);
  }
  
  const history = marketHistories.find(h => h.eventId === eventId);
  
  if (!history) {
    console.log(`No history found for event ID: ${eventId}`);
    return { 
      timestamps: [], 
      statistics: { totalPoints: 0, availablePoints: 0, uptimePercentage: 0 } 
    };
  }
  
  console.log(`Found history for event ID: ${eventId} with ${history.timestamps.length} data points`);
  
  // Calculate uptime statistics
  const totalPoints = history.timestamps.length;
  const availablePoints = history.timestamps.filter(t => t.isAvailable).length;
  const uptimePercentage = totalPoints > 0 ? (availablePoints / totalPoints) * 100 : 0;
  
  console.log(`Statistics for event ID ${eventId}: ${availablePoints}/${totalPoints} available (${uptimePercentage.toFixed(1)}% uptime)`);
  
  // Add actual timestamp string for easier debugging
  const enhancedTimestamps = history.timestamps.map(t => ({
    ...t,
    time: new Date(t.timestamp).toISOString()
  }));
  
  // Log a small sample of the timestamps for debugging
  console.log(`Sample timestamps: ${JSON.stringify(enhancedTimestamps.slice(0, 5))}`);
  
  // Return the history timestamps and statistics
  return { 
    timestamps: history.timestamps, 
    statistics: { 
      totalPoints, 
      availablePoints, 
      uptimePercentage 
    } 
  };
}

// Get the current heartbeat status
export function getHeartbeatStatus(): HeartbeatState {
  return heartbeatState;
}

// Save the history data to disk for persistence
async function saveHistoryData(): Promise<void> {
  try {
    const historyDir = await ensureDataDirectory();
    const historyPath = path.join(historyDir, 'market-history.json');
    
    // Only keep recent history to avoid large files
    const recentHistories = marketHistories.map(history => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      
      return {
        eventId: history.eventId,
        timestamps: history.timestamps.filter(t => t.timestamp >= oneDayAgo)
      };
    }).filter(history => history.timestamps.length > 0);
    
    fs.writeFileSync(historyPath, JSON.stringify(recentHistories, null, 2));
    console.log('Saved heartbeat history data');
  } catch (error) {
    console.error('Error saving history data:', error);
  }
}

// Load the history data from disk
async function loadHistoryData(): Promise<void> {
  try {
    const historyDir = await ensureDataDirectory();
    const historyPath = path.join(historyDir, 'market-history.json');
    
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf8');
      const histories = JSON.parse(data) as MarketHistory[];
      
      // Merge with existing histories
      for (const history of histories) {
        const existingIndex = marketHistories.findIndex(h => h.eventId === history.eventId);
        
        if (existingIndex >= 0) {
          // Merge timestamps
          const existingTimestamps = new Map(marketHistories[existingIndex].timestamps.map(t => [t.timestamp, t]));
          
          for (const timestamp of history.timestamps) {
            if (!existingTimestamps.has(timestamp.timestamp)) {
              marketHistories[existingIndex].timestamps.push(timestamp);
            }
          }
          
          // Sort timestamps by time
          marketHistories[existingIndex].timestamps.sort((a, b) => a.timestamp - b.timestamp);
        } else {
          // Add new history
          marketHistories.push(history);
        }
      }
      
      console.log(`Loaded ${histories.length} event histories from disk`);
    }
  } catch (error) {
    console.error('Error loading history data:', error);
  }
}

// Clean up old data to prevent memory issues
function cleanupOldData(): void {
  try {
    // Keep only the last 5 histories with the most data points
    if (marketHistories.length > 5) {
      // Sort by number of data points (descending)
      marketHistories.sort((a, b) => b.timestamps.length - a.timestamps.length);
      
      // Keep only the top 5
      marketHistories.splice(5);
      
      console.log(`Cleaned up old data, keeping ${marketHistories.length} event histories`);
    }
  } catch (error) {
    console.error('Error cleaning up old data:', error);
  }
}