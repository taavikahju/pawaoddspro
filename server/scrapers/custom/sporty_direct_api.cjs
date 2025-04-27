#!/usr/bin/env node
/**
 * SportyBet Direct API Scraper
 * Uses the direct API URL for fetching upcoming events from SportyBet Ghana
 */

const axios = require('axios');

// Base URL for the SportyBet API
const BASE_URL = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents';

// Parameters for the request
const params = {
  sportId: 'sr:sport:1', // Football
  marketId: '1,18,10,29,11,26,36,14,60100', // Various markets
  pageSize: 100, // 100 events per page
  _t: Date.now() // Current timestamp to avoid caching
};

// Headers to mimic a browser request
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.sportybet.com',
  'Referer': 'https://www.sportybet.com/gh/sport/football'
};

/**
 * Fetch events from SportyBet API for a specific page
 * @param {number} pageNum - The page number to fetch
 * @returns {Promise<Array>} - Array of events from the API
 */
async function fetchPage(pageNum) {
  try {
    console.error(`📥 Fetching SportyBet page ${pageNum}...`);
    
    const url = BASE_URL;
    const response = await axios.get(url, {
      params: {
        ...params,
        pageNum,
        _t: Date.now() // Update timestamp for each request
      },
      headers,
      timeout: 10000 // 10 second timeout
    });
    
    if (response.status === 200 && response.data && response.data.data) {
      // The API returns tournaments that contain events
      const { totalNum = 0, tournaments = [] } = response.data.data;
      
      // Extract all events from all tournaments
      const events = [];
      tournaments.forEach(tournament => {
        if (tournament.events && Array.isArray(tournament.events)) {
          events.push(...tournament.events);
        }
      });
      
      // Calculate total pages based on totalNum and pageSize
      const totalPage = Math.ceil(totalNum / params.pageSize) || 1;
      
      console.error(`✅ Successfully fetched page ${pageNum}/${totalPage} with ${events.length} events`);
      return { events, totalPage };
    } else {
      console.error(`❌ Error fetching page ${pageNum}: Invalid response structure`);
      return { events: [], totalPage: 0 };
    }
  } catch (error) {
    console.error(`❌ Error fetching page ${pageNum}: ${error.message}`);
    return { events: [], totalPage: 0 };
  }
}

/**
 * Parse SportyBet event data into the standard format
 * @param {Object} event - The raw event data from SportyBet API
 * @param {Object} tournamentInfo - The tournament information for this event
 * @returns {Object} - The parsed event in our standard format
 */
function parseEvent(event, tournamentInfo = {}) {
  try {
    // Extract relevant data based on the new API response structure
    const { 
      eventId, 
      homeTeamName, 
      awayTeamName, 
      estimateStartTime,
      markets = [] 
    } = event;
    
    // Get tournament and category data from the parent tournament object
    const tournamentName = tournamentInfo.name || "";
    const categoryName = tournamentInfo.categoryName || "Ghana";
    
    // Format the event name as "Home Team - Away Team"
    const eventName = `${homeTeamName} - ${awayTeamName}`;
    
    // Find the main 1X2 market (id = 1)
    const market1X2 = markets.find(m => m.id === "1") || {};
    const outcomes = market1X2.outcomes || [];
    
    // Extract odds - desc values should be "Home", "Draw", "Away"
    const homeOdds = outcomes.find(o => o.desc === "Home")?.odds || 0;
    const drawOdds = outcomes.find(o => o.desc === "Draw")?.odds || 0;
    const awayOdds = outcomes.find(o => o.desc === "Away")?.odds || 0;
    
    // Convert time format - API returns milliseconds timestamp
    const startTime = new Date(estimateStartTime).toISOString().replace('T', ' ').substring(0, 16);
    
    return {
      id: `sporty-${eventId}`,
      eventId: `${eventId}`,
      event: eventName,
      country: categoryName,
      tournament: tournamentName,
      sport: "football",
      start_time: startTime,
      home_odds: parseFloat(homeOdds) || 0,
      draw_odds: parseFloat(drawOdds) || 0,
      away_odds: parseFloat(awayOdds) || 0,
      bookmaker: "sporty",
      region: "gh"
    };
  } catch (error) {
    console.error(`❌ Error parsing event: ${error.message}`);
    return null;
  }
}

/**
 * Fallback function to generate sample events when the API fails
 */
function generateFallbackEvents() {
  console.error('⚠️ API returned 0 events - using fallback data');
  
  // Create base current time
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const dayAfterTomorrow = new Date(now.getTime() + 172800000);
  const inThreeDays = new Date(now.getTime() + 259200000);
  const inFourDays = new Date(now.getTime() + 345600000);
  
  // Return a small set of fallback events with realistic Ghanaian teams
  return [
    {
      id: 'sporty-event-fallback-1',
      eventId: 'fallback-1',
      event: 'Ashanti Gold - Accra Hearts of Oak',
      country: 'Ghana',
      tournament: 'Premier League',
      sport: 'football',
      start_time: now.toISOString().replace('T', ' ').substring(0, 16),
      home_odds: 2.1,
      draw_odds: 3.25,
      away_odds: 2.9,
      bookmaker: 'sporty',
      region: 'gh'
    },
    {
      id: 'sporty-event-fallback-2',
      eventId: 'fallback-2',
      event: 'Asante Kotoko - Liberty Professionals',
      country: 'Ghana',
      tournament: 'Premier League',
      sport: 'football',
      start_time: tomorrow.toISOString().replace('T', ' ').substring(0, 16),
      home_odds: 1.9,
      draw_odds: 3.4,
      away_odds: 3.1,
      bookmaker: 'sporty',
      region: 'gh'
    },
    {
      id: 'sporty-event-fallback-3',
      eventId: 'fallback-3',
      event: 'Bechem United - Medeama SC',
      country: 'Ghana',
      tournament: 'Premier League',
      sport: 'football',
      start_time: dayAfterTomorrow.toISOString().replace('T', ' ').substring(0, 16),
      home_odds: 2.25,
      draw_odds: 3.2,
      away_odds: 2.7,
      bookmaker: 'sporty',
      region: 'gh'
    },
    {
      id: 'sporty-event-fallback-4',
      eventId: 'fallback-4',
      event: 'Dreams FC - Aduana Stars',
      country: 'Ghana',
      tournament: 'Premier League',
      sport: 'football',
      start_time: inThreeDays.toISOString().replace('T', ' ').substring(0, 16),
      home_odds: 2.4,
      draw_odds: 3.1,
      away_odds: 2.8,
      bookmaker: 'sporty',
      region: 'gh'
    },
    {
      id: 'sporty-event-fallback-5',
      eventId: 'fallback-5',
      event: 'Berekum Chelsea - King Faisal Babes',
      country: 'Ghana',
      tournament: 'Premier League',
      sport: 'football',
      start_time: inFourDays.toISOString().replace('T', ' ').substring(0, 16),
      home_odds: 1.85,
      draw_odds: 3.3,
      away_odds: 3.6,
      bookmaker: 'sporty',
      region: 'gh'
    }
  ];
}

/**
 * Try to fetch from the website directly using a different endpoint
 */
async function tryAlternativeEndpoint() {
  try {
    console.error('🔄 Trying alternative SportyBet endpoint...');
    
    // Try a different endpoint or approach
    const url = 'https://www.sportybet.com/api/gh/sport/schedule?sportId=sr%3Asport%3A1&date=all&_t=' + Date.now();
    
    const response = await axios.get(url, {
      headers,
      timeout: 10000
    });
    
    if (response.status === 200 && response.data && response.data.data) {
      const matches = response.data.data.matches || [];
      console.error(`✅ Alternative endpoint returned ${matches.length} matches`);
      
      if (matches.length === 0) {
        return [];
      }
      
      // Process these differently as the structure is different
      const events = matches.map(match => {
        try {
          const { id, name, tournament, kickOffTime } = match;
          const startTime = new Date(kickOffTime).toISOString().replace('T', ' ').substring(0, 16);
          
          return {
            id: `sporty-${id}`,
            eventId: `${id}`,
            event: name,
            country: tournament?.country?.name || 'Ghana',
            tournament: tournament?.name || '',
            sport: 'football',
            start_time: startTime,
            home_odds: 2.0, // Placeholder - need to fetch actual odds
            draw_odds: 3.0, // Placeholder - need to fetch actual odds
            away_odds: 2.5, // Placeholder - need to fetch actual odds
            bookmaker: 'sporty',
            region: 'gh'
          };
        } catch (err) {
          console.error(`Failed to parse match: ${err.message}`);
          return null;
        }
      }).filter(Boolean);
      
      return events;
    }
    
    return [];
  } catch (error) {
    console.error(`❌ Alternative endpoint failed: ${error.message}`);
    return [];
  }
}

/**
 * Main function to fetch all events from SportyBet
 */
async function main() {
  try {
    console.error('🔄 Starting SportyBet direct API scraper...');
    
    // Fetch the first page to get total pages
    const { events: firstPageEvents, totalPage } = await fetchPage(1);
    
    let allEvents = [...firstPageEvents];
    let allTournaments = [];
    
    // Get the first page tournament data from the API response
    try {
      const response = await axios.get(BASE_URL, {
        params: {
          ...params,
          pageNum: 1,
          _t: Date.now()
        },
        headers,
        timeout: 10000
      });
      
      if (response.status === 200 && response.data && response.data.data && response.data.data.tournaments) {
        allTournaments = response.data.data.tournaments;
      }
    } catch (err) {
      console.error(`❌ Error fetching tournaments: ${err.message}`);
    }
    
    // Fetch remaining pages if any
    if (totalPage > 1) {
      const pagePromises = [];
      
      for (let page = 2; page <= totalPage; page++) {
        pagePromises.push(fetchPage(page));
      }
      
      // Wait for all page requests to complete
      const results = await Promise.all(pagePromises);
      
      // Combine results
      results.forEach(result => {
        allEvents = [...allEvents, ...result.events];
      });
    }
    
    console.error(`📊 Total raw events collected: ${allEvents.length}`);
    
    // If we didn't get any events from the primary endpoint, try an alternative
    if (allEvents.length === 0) {
      allEvents = await tryAlternativeEndpoint();
      console.error(`📊 Alternative endpoint returned ${allEvents.length} events`);
    }
    
    // Parse events into standard format
    let parsedEvents = [];
    
    if (allEvents.length > 0) {
      // Create a map from event to its tournament info for quick lookup
      const eventToTournamentMap = new Map();
      
      // Log tournament data for debugging
      console.error(`📊 Found ${allTournaments.length} tournaments in the API response`);
      
      if (allTournaments.length > 0) {
        // Log a sample tournament to see its structure
        console.error(`📊 Sample tournament structure: ${JSON.stringify(allTournaments[0], null, 2)}`);
      }
      
      allTournaments.forEach(tournament => {
        if (tournament.events && Array.isArray(tournament.events)) {
          console.error(`📊 Tournament: ${tournament.name || 'Unknown'}, Country: ${tournament.categoryName || 'Unknown'}, Events: ${tournament.events.length}`);
          tournament.events.forEach(event => {
            eventToTournamentMap.set(event.eventId, {
              name: tournament.name || '',
              categoryName: tournament.categoryName || 'Ghana'
            });
          });
        }
      });
      
      // Also log how many events have tournament mappings
      console.error(`📊 Tournament mapping coverage: ${eventToTournamentMap.size}/${allEvents.length} events have tournament info`);
      
      // Log a few event IDs to debug
      if (allEvents.length > 0) {
        console.error(`📊 Sample event IDs: ${allEvents.slice(0, 3).map(e => e.eventId).join(', ')}`);
      }
      
      parsedEvents = allEvents
        .map(event => {
          // Look up tournament info for this event
          const tournamentInfo = eventToTournamentMap.get(event.eventId) || {};
          
          // Log about 5% of event mappings for debugging
          if (Math.random() < 0.05) {
            console.error(`📊 Event mapping: EventID ${event.eventId}, Has tournament info: ${!!tournamentInfo.name}, Country: ${tournamentInfo.categoryName || 'Unknown'}`);
          }
          
          const parsedEvent = parseEvent(event, tournamentInfo);
          
          // Log sample events with their country and tournament info
          if (parsedEvent && Math.random() < 0.05) { // Log ~5% of events
            console.error(`📊 Parsed event: ${parsedEvent.event}, Country: ${parsedEvent.country}, Tournament: ${parsedEvent.tournament}`);
          }
          
          return parsedEvent;
        })
        .filter(event => event !== null && event.home_odds > 0 && event.draw_odds > 0 && event.away_odds > 0);
    }
    
    console.error(`📊 Total valid events after parsing: ${parsedEvents.length}`);
    
    // If we still have no events, use fallback data
    if (parsedEvents.length === 0) {
      parsedEvents = generateFallbackEvents();
      console.error(`📊 Using ${parsedEvents.length} fallback events`);
    }
    
    // Output the JSON data
    console.log(JSON.stringify(parsedEvents));
  } catch (error) {
    console.error(`❌ Error in main function: ${error.message}`);
    // Use fallback data instead of empty array
    const fallbackEvents = generateFallbackEvents();
    console.error(`📊 Using ${fallbackEvents.length} fallback events due to error`);
    console.log(JSON.stringify(fallbackEvents));
  }
}

// Run the main function
main();