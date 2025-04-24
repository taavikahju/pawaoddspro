#!/usr/bin/env node
const axios = require('axios');

// Configure multiple API endpoints for faster and more robust data retrieval
// SportyBet has different endpoints for its main categories of events
const ENDPOINTS = [
  // Main football/soccer upcoming events endpoint 
  {
    url: 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents',
    params: {
      sportId: 'sr:sport:1',
      marketId: '1',         // Just get 1X2 markets for efficiency
      pageSize: '50',        // Reduced page size for faster response
      option: '1'
    }
  },
  // Popular leagues endpoint - tends to be fast and have high-quality data
  {
    url: 'https://www.sportybet.com/api/gh/factsCenter/pcPopularLeague',
    params: {
      sportId: 'sr:sport:1', 
      marketId: '1',
      option: '1'
    }
  }
];

// Use browser-like headers to avoid API blocks
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9'
};

// More efficient timeout implementation
const fetchWithTimeout = async (url, options, timeout = 5000) => {
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
    console.error(`Request error: ${error.message}`);
    throw error;
  }
};

// Fetch data from all endpoints in parallel
const fetchFromAllEndpoints = async () => {
  console.error(`📊 Starting Sportybet data collection from ${ENDPOINTS.length} sources...`);
  
  const endpointPromises = ENDPOINTS.map(async (endpoint, index) => {
    try {
      // Construct query string for this endpoint
      const queryString = Object.entries(endpoint.params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      
      // Fetch first page to get metadata and first batch of results
      const firstPageUrl = `${endpoint.url}?${queryString}&pageNum=1&_t=${Date.now()}`;
      console.error(`📥 Fetching source ${index + 1}, page 1...`);
      
      const firstPageRes = await fetchWithTimeout(firstPageUrl, { headers: HEADERS }, 8000);
      const firstPageData = firstPageRes.data?.data;
      
      if (!firstPageData || !firstPageData.tournaments || !Array.isArray(firstPageData.tournaments)) {
        console.error(`❌ No data from source ${index + 1}`);
        return [];
      }
      
      // Calculate total pages, but limit to a reasonable number
      const totalEvents = firstPageData.totalNum || 0;
      const pageSize = parseInt(endpoint.params.pageSize || '50');
      let totalPages = Math.ceil(totalEvents / pageSize);
      
      // Hard limit on pages to prevent timeout
      totalPages = Math.min(totalPages, 3);
      
      console.error(`📊 Source ${index + 1}: Found ${totalEvents} events across ${totalPages} pages`);
      
      // Store first page results
      let allTournaments = firstPageData.tournaments || [];
      
      // Only fetch additional pages if needed
      if (totalPages > 1) {
        // Fetch pages 2-3 in parallel
        const pagePromises = [];
        for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
          const url = `${endpoint.url}?${queryString}&pageNum=${pageNum}&_t=${Date.now()}`;
          pagePromises.push(
            fetchWithTimeout(url, { headers: HEADERS }, 5000)
              .then(res => {
                const data = res.data?.data;
                if (data && data.tournaments) {
                  console.error(`✅ Source ${index + 1}, page ${pageNum}: ${data.tournaments.length} tournaments`);
                  return data.tournaments;
                }
                return [];
              })
              .catch(() => {
                console.error(`❌ Failed to fetch source ${index + 1}, page ${pageNum}`);
                return [];
              })
          );
        }
        
        // Wait for all page requests to complete
        const additionalPages = await Promise.all(pagePromises);
        
        // Add results to collection
        for (const tournaments of additionalPages) {
          allTournaments = allTournaments.concat(tournaments);
        }
      }
      
      console.error(`📊 Source ${index + 1}: Collected ${allTournaments.length} tournaments`);
      return allTournaments;
    } catch (error) {
      console.error(`❌ Error in source ${index + 1}: ${error.message}`);
      return [];
    }
  });
  
  // Wait for all endpoint requests to complete
  const results = await Promise.all(endpointPromises);
  
  // Combine results from all endpoints
  let allTournaments = [];
  for (const tournaments of results) {
    allTournaments = allTournaments.concat(tournaments);
  }
  
  console.error(`📊 Total collected: ${allTournaments.length} tournaments`);
  return allTournaments;
};

// Process tournaments to extract events
const processEvents = (tournaments) => {
  // Initialize a map to track unique events
  const eventMap = new Map();
  const processed = { count: 0, skipped: 0 };
  
  console.error(`⚙️ Processing tournaments data...`);
  
  // Process each tournament
  for (const tournament of tournaments) {
    try {
      const country = tournament.events?.[0]?.sport?.category?.name || 'Unknown';
      const tournamentName = tournament.name || 'Unknown';
      
      if (!tournament.events || !Array.isArray(tournament.events)) {
        continue;
      }

      // Process all events in this tournament
      for (const event of tournament.events) {
        try {
          if (!event.homeTeamName || !event.awayTeamName || !event.eventId) {
            processed.skipped++;
            continue;
          }
          
          // Find the 1X2 market (standard football betting market)
          const market = event.markets?.find(m => m.id === "1");
          if (!market || !market.outcomes) {
            processed.skipped++;
            continue;
          }
          
          // Extract odds values
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
          
          if (!homeOdds || !drawOdds || !awayOdds) {
            processed.skipped++;
            continue;
          }
          
          // Format the start time
          const startTime = event.estimateStartTime
            ? new Date(event.estimateStartTime).toISOString().slice(0, 16).replace('T', ' ')
            : null;
            
          if (!startTime) {
            processed.skipped++;
            continue;
          }
          
          // Clean the eventId to extract just the numeric part
          const eventId = event.eventId.replace(/\D/g, '');
          if (!eventId) {
            processed.skipped++;
            continue;
          }
          
          // Use eventId as key to avoid duplicates from different sources
          if (!eventMap.has(eventId)) {
            eventMap.set(eventId, {
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
            processed.count++;
          }
        } catch (eventError) {
          processed.skipped++;
          continue;
        }
      }
    } catch (tournamentError) {
      continue;
    }
  }
  
  console.error(`✅ Processed ${processed.count} valid events (skipped ${processed.skipped})`);
  return Array.from(eventMap.values());
};

const run = async () => {
  try {
    // Set a strict timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Global timeout after 30 seconds")), 30000);
    });

    const tournamentPromise = fetchFromAllEndpoints();
    
    // Race between fetching data and timeout
    const tournaments = await Promise.race([tournamentPromise, timeoutPromise])
      .catch(error => {
        console.error(`Operation error: ${error.message}`);
        return [];
      });

    // Process tournaments into events
    const events = processEvents(tournaments);
    
    if (events.length === 0) {
      console.error('No valid events found');
      console.log(JSON.stringify([]));
      return;
    }
    
    console.error(`✅ Successfully extracted ${events.length} valid events`);
    
    // Output to stdout for the integration system
    console.log(JSON.stringify(events));
  } catch (error) {
    console.error('Fatal error in scraper:', error.message);
    console.log(JSON.stringify([]));
  }
};

// Let's go!
run();