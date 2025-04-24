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
      pageSize: '100',       // Max page size for more data
      option: '1'
    },
    maxPages: 10             // Fetch up to 10 pages (1000 events)
  },
  // Popular leagues endpoint
  {
    url: 'https://www.sportybet.com/api/gh/factsCenter/pcPopularLeague',
    params: {
      sportId: 'sr:sport:1', 
      marketId: '1',
      option: '1'
    },
    maxPages: 3              // Fetch up to 3 pages
  },
  // Live now endpoint - gets currently active matches
  {
    url: 'https://www.sportybet.com/api/gh/factsCenter/pcLiveNow',
    params: {
      sportId: 'sr:sport:1',
      marketId: '1',
      option: '1'
    },
    maxPages: 1              // Usually just 1 page
  }
];

// More countries to query specifically - each can have hundreds of events
const COUNTRY_ENDPOINTS = [
  // English football - highly popular
  {
    url: 'https://www.sportybet.com/api/gh/factsCenter/pcCategory',
    params: {
      sportId: 'sr:sport:1',
      categoryId: 'sr:category:1',  // England
      marketId: '1',
      pageSize: '100',
      option: '1'
    },
    maxPages: 3
  },
  // Spanish football
  {
    url: 'https://www.sportybet.com/api/gh/factsCenter/pcCategory',
    params: {
      sportId: 'sr:sport:1',
      categoryId: 'sr:category:32', // Spain
      marketId: '1',
      pageSize: '100',
      option: '1'
    },
    maxPages: 3
  },
  // German football
  {
    url: 'https://www.sportybet.com/api/gh/factsCenter/pcCategory',
    params: {
      sportId: 'sr:sport:1',
      categoryId: 'sr:category:30', // Germany
      marketId: '1',
      pageSize: '100',
      option: '1'
    },
    maxPages: 3
  },
  // African football
  {
    url: 'https://www.sportybet.com/api/gh/factsCenter/pcCategory',
    params: {
      sportId: 'sr:sport:1',
      categoryId: 'sr:category:13', // Ghana
      marketId: '1',
      pageSize: '100',
      option: '1'
    },
    maxPages: 2
  }
];

// Combine all endpoints
const ALL_ENDPOINTS = [...ENDPOINTS, ...COUNTRY_ENDPOINTS];

// Use browser-like headers to avoid API blocks
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.sportybet.com/gh/sports/soccer',
  'Origin': 'https://www.sportybet.com'
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

// Fetch data from all endpoints in parallel with improved batch processing
const fetchFromAllEndpoints = async () => {
  console.error(`📊 Starting Sportybet data collection from ${ALL_ENDPOINTS.length} sources...`);
  
  // Total number of tournaments collected
  let tournamentCount = 0;
  
  // To store all tournaments
  let allTournaments = [];
  
  // Process endpoints in batches to avoid hitting rate limits
  const BATCH_SIZE = 2;
  const batches = Math.ceil(ALL_ENDPOINTS.length / BATCH_SIZE);
  
  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, ALL_ENDPOINTS.length);
    const currentBatch = ALL_ENDPOINTS.slice(startIdx, endIdx);
    
    console.error(`📊 Processing batch ${batchIndex + 1}/${batches} (endpoints ${startIdx + 1}-${endIdx})...`);
    
    const batchPromises = currentBatch.map(async (endpoint, localIndex) => {
      const endpointIndex = startIdx + localIndex;
      try {
        // Construct query string for this endpoint
        const queryString = Object.entries(endpoint.params)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('&');
        
        // Fetch first page to get metadata and first batch of results
        const firstPageUrl = `${endpoint.url}?${queryString}&pageNum=1&_t=${Date.now()}`;
        console.error(`📥 Fetching source ${endpointIndex + 1}, page 1...`);
        
        const firstPageRes = await fetchWithTimeout(firstPageUrl, { headers: HEADERS }, 8000);
        const firstPageData = firstPageRes.data?.data;
        
        if (!firstPageData || !firstPageData.tournaments || !Array.isArray(firstPageData.tournaments)) {
          console.error(`❌ No data from source ${endpointIndex + 1}`);
          return [];
        }
        
        // Calculate total pages, but limit to a reasonable number
        const totalEvents = firstPageData.totalNum || 0;
        const pageSize = parseInt(endpoint.params.pageSize || '50');
        let totalPages = Math.ceil(totalEvents / pageSize);
        
        // Hard limit on pages to prevent timeout - use the endpoint-specific maxPages
        totalPages = Math.min(totalPages, endpoint.maxPages || 3);
        
        console.error(`📊 Source ${endpointIndex + 1}: Found ${totalEvents} events across ${totalPages} pages (using ${Math.min(totalPages, endpoint.maxPages)} pages)`);
        
        // Store first page results
        let endpointTournaments = firstPageData.tournaments || [];
        
        // Only fetch additional pages if needed
        if (totalPages > 1) {
          // Fetch remaining pages one by one to avoid timeouts
          for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
            const url = `${endpoint.url}?${queryString}&pageNum=${pageNum}&_t=${Date.now()}`;
            console.error(`📥 Fetching source ${endpointIndex + 1}, page ${pageNum}...`);
            
            try {
              const response = await fetchWithTimeout(url, { headers: HEADERS }, 8000);
              const data = response.data?.data;
              
              if (data && data.tournaments && data.tournaments.length > 0) {
                console.error(`✅ Source ${endpointIndex + 1}, page ${pageNum}: ${data.tournaments.length} tournaments`);
                endpointTournaments = endpointTournaments.concat(data.tournaments);
              } else {
                console.error(`⚠️ Source ${endpointIndex + 1}, page ${pageNum}: No tournaments`);
              }
            } catch (pageError) {
              console.error(`❌ Failed to fetch source ${endpointIndex + 1}, page ${pageNum}: ${pageError.message}`);
            }
            
            // Small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        console.error(`📊 Source ${endpointIndex + 1}: Collected ${endpointTournaments.length} tournaments`);
        return endpointTournaments;
      } catch (error) {
        console.error(`❌ Error in source ${endpointIndex + 1}: ${error.message}`);
        return [];
      }
    });
    
    // Wait for current batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Process batch results
    for (const tournaments of batchResults) {
      allTournaments = allTournaments.concat(tournaments);
      tournamentCount += tournaments.length;
    }
    
    console.error(`📊 After batch ${batchIndex + 1}: Collected ${tournamentCount} tournaments total`);
    
    // Brief pause between batches to avoid rate limiting
    if (batchIndex < batches - 1) {
      console.error('Pausing briefly before next batch...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error(`📊 Total collected: ${allTournaments.length} tournaments`);
  return allTournaments;
};

// Process tournaments to extract events 
const processEvents = (tournaments) => {
  // Initialize a map to track unique events by ID
  const eventMap = new Map();
  const processed = { count: 0, skipped: 0 };
  
  console.error(`⚙️ Processing tournaments data...`);
  
  // Process each tournament
  for (const tournament of tournaments) {
    try {
      if (!tournament || !tournament.events) continue;
      
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
          const market = event.markets?.find(m => m.id === "1" || m.name === "1X2");
          if (!market || !market.outcomes) {
            processed.skipped++;
            continue;
          }
          
          // Extract odds values
          let homeOdds = null;
          let drawOdds = null;
          let awayOdds = null;
          
          // Process outcomes differently based on format
          for (const outcome of market.outcomes) {
            if (!outcome) continue;
            
            // Handle missing desc by trying alternative properties
            const desc = (outcome.desc || outcome.name || outcome.outcome || "").toString().toLowerCase();
            
            if (desc.includes('home') || desc === '1') {
              homeOdds = outcome.odds;
            } else if (desc.includes('draw') || desc === 'x') {
              drawOdds = outcome.odds;
            } else if (desc.includes('away') || desc === '2') {
              awayOdds = outcome.odds;
            }
          }
          
          // Skip if any odds are missing
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
            
            // Log progress every 100 events
            if (processed.count % 100 === 0) {
              console.error(`✓ Processed ${processed.count} events so far...`);
            }
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
    // Set a reasonable timeout for the entire operation (50 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Global timeout after 50 seconds")), 50000);
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