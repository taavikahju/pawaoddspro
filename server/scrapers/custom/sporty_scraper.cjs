#!/usr/bin/env node
const axios = require('axios');

// Alternative API endpoint that loads faster
const BASE_URL = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents';
const QUERY = 'sportId=sr%3Asport%3A1&marketId=1&pageSize=50&option=1';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache'
};

// More efficient implementation with timeouts
const fetchWithTimeout = async (url, options, timeout = 2500) => {
  try {
    const source = axios.CancelToken.source();
    const id = setTimeout(() => {
      source.cancel('Request timeout');
    }, timeout);
    
    const response = await axios({
      ...options,
      url,
      cancelToken: source.token,
      timeout: timeout
    });
    
    clearTimeout(id);
    return response;
  } catch (error) {
    console.error(`Fetch error: ${error.message}`);
    throw error;
  }
};

// Only fetch first page to avoid timeout issues
const fetchEvents = async () => {
  const url = `${BASE_URL}?${QUERY}&pageNum=1&_t=${Date.now()}`;
  console.error(`📥 Fetching Sportybet events...`);
  
  try {
    const res = await fetchWithTimeout(url, { headers: HEADERS }, 5000);
    const data = res.data?.data;
    
    if (!data || !data.tournaments) {
      console.error('❌ No events found');
      return [];
    }
    
    return data.tournaments;
  } catch (err) {
    console.error(`❌ Failed to fetch events: ${err.message}`);
    return [];
  }
};

const run = async () => {
  try {
    // Set a global timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Global operation timeout")), 10000);
    });

    const tournamentPromise = fetchEvents();
    
    // Race between fetching data and timeout
    const tournaments = await Promise.race([tournamentPromise, timeoutPromise])
      .catch(error => {
        console.error(`Error: ${error.message}`);
        return [];
      });

    console.error(`📊 Processing ${tournaments.length} tournaments`);
    
    if (!tournaments || tournaments.length === 0) {
      console.error('No tournaments found');
      console.log(JSON.stringify([]));
      return;
    }

    const flatEvents = [];
    let processedCount = 0;
    
    // Process tournaments with a limit
    for (const tournament of tournaments) {
      if (processedCount >= 100) break; // Safety limit
      
      const country = tournament.events?.[0]?.sport?.category?.name || 'Unknown';
      const tournamentName = tournament.name || 'Unknown';
      
      if (!tournament.events || !Array.isArray(tournament.events)) {
        continue;
      }

      // Process events with a limit
      for (const event of tournament.events.slice(0, 10)) {
        if (processedCount >= 100) break; // Safety limit
        
        try {
          if (!event.homeTeamName || !event.awayTeamName) continue;
          
          const market = event.markets?.find(m => m.id === "1");
          if (!market || !market.outcomes) continue;
          
          // Find the home, draw and away odds from the outcomes
          let homeOdds = null;
          let drawOdds = null;
          let awayOdds = null;
          
          for (const outcome of market.outcomes) {
            if (!outcome || !outcome.desc) continue;
            
            const desc = outcome.desc.toString().toLowerCase();
            if (desc === 'home' || desc === '1') {
              homeOdds = outcome.odds;
            } else if (desc === 'draw' || desc === 'x') {
              drawOdds = outcome.odds;
            } else if (desc === 'away' || desc === '2') {
              awayOdds = outcome.odds;
            }
          }
          
          if (!homeOdds || !drawOdds || !awayOdds) continue;
          
          const startTime = event.estimateStartTime
            ? new Date(event.estimateStartTime).toISOString().slice(0, 16).replace('T', ' ')
            : null;
            
          if (!startTime) continue;
          
          // Clean the eventId - remove non-numeric characters
          const eventId = event.eventId.replace(/\D/g, '');
          if (!eventId) continue;
          
          flatEvents.push({
            eventId,
            country,
            tournament: tournamentName,
            event: `${event.homeTeamName} - ${event.awayTeamName}`,
            market: "1X2",
            home_odds: homeOdds,
            draw_odds: drawOdds,
            away_odds: awayOdds,
            start_time: startTime
          });
          
          processedCount++;
        } catch (eventError) {
          console.error('Error processing event:', eventError.message);
        }
      }
    }
    
    console.error(`✅ Processed ${flatEvents.length} valid events`);
    
    // Output to stdout for the integration system
    console.log(JSON.stringify(flatEvents));
  } catch (error) {
    console.error('Error in scraper:', error.message);
    // Return empty array
    console.log(JSON.stringify([]));
  }
};

run();