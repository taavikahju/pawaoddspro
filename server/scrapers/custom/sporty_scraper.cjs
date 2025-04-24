#!/usr/bin/env node
const axios = require('axios');

// ==== CONFIGURATION ====
// Primary Sportybet API country code - trying multiple regions/countries
const REGIONS = ['gh', 'ke', 'ng', 'ug', 'tz'];

// Configure multiple API endpoints from different Sportybet regional APIs
const buildEndpoints = () => {
  const endpoints = [];
  
  // Generate endpoints for each regional API to maximize data collection
  for (const region of REGIONS) {
    // Main API endpoints that work across all regions
    endpoints.push(
      // Main upcoming events - best source for all matches
      {
        url: `https://www.sportybet.com/api/${region}/factsCenter/pcUpcomingEvents`,
        params: {
          sportId: 'sr:sport:1',
          marketId: '1',
          pageSize: '100',
          option: '1'
        },
        region,
        maxPages: 10
      },
      // Today's matches - has most immediate matches with good data
      {
        url: `https://www.sportybet.com/api/${region}/factsCenter/pcToday`,
        params: {
          sportId: 'sr:sport:1',
          marketId: '1',
          pageSize: '100',
          option: '1'
        },
        region,
        maxPages: 5
      }
    );
  }
  
  // Use the Ghana API (most complete) for specific regional data
  const majorCountryCategories = [
    { id: 'sr:category:1', name: 'England' },   // England
    { id: 'sr:category:27', name: 'Italy' },    // Italy
    { id: 'sr:category:31', name: 'France' },   // France
    { id: 'sr:category:32', name: 'Spain' },    // Spain
    { id: 'sr:category:30', name: 'Germany' },  // Germany
    { id: 'sr:category:13', name: 'Ghana' },    // Ghana
    { id: 'sr:category:14', name: 'Nigeria' },  // Nigeria
    { id: 'sr:category:45', name: 'Kenya' },    // Kenya
    { id: 'sr:category:48', name: 'South Africa' } // South Africa
  ];
  
  // Add country-specific endpoints (separate from regional APIs)
  majorCountryCategories.forEach(country => {
    endpoints.push({
      url: 'https://www.sportybet.com/api/gh/factsCenter/pcCategory',
      params: {
        sportId: 'sr:sport:1',
        categoryId: country.id,
        marketId: '1',
        pageSize: '100',
        option: '1'
      },
      region: 'gh',
      name: country.name,
      maxPages: 3
    });
  });
  
  // Add major tournament endpoints which often have detailed data
  const majorTournaments = [
    { id: 'sr:tournament:8', name: 'UEFA Champions League' },
    { id: 'sr:tournament:679', name: 'UEFA Europa League' },
    { id: 'sr:tournament:17', name: 'English Premier League' },
    { id: 'sr:tournament:23', name: 'Spanish La Liga' },
    { id: 'sr:tournament:34', name: 'Italian Serie A' },
    { id: 'sr:tournament:35', name: 'German Bundesliga' },
    { id: 'sr:tournament:47', name: 'French Ligue 1' }
  ];
  
  majorTournaments.forEach(tournament => {
    endpoints.push({
      url: 'https://www.sportybet.com/api/gh/factsCenter/pcTournament',
      params: {
        sportId: 'sr:sport:1',
        tournamentId: tournament.id,
        marketId: '1',
        pageSize: '100',
        option: '1'
      },
      region: 'gh',
      name: tournament.name,
      maxPages: 2
    });
  });
  
  return endpoints;
};

// Generate all endpoints
const ALL_ENDPOINTS = buildEndpoints();

// Browser-like headers with country-specific variants for different regions
const getHeaders = (region = 'gh') => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': `https://www.sportybet.com/${region}/sports/soccer`,
  'Origin': 'https://www.sportybet.com',
  'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"'
});

// Efficient fetch implementation with cancelable requests
const fetchWithTimeout = async (url, options, timeout = 7000) => {
  try {
    const source = axios.CancelToken.source();
    const id = setTimeout(() => {
      source.cancel('Operation timeout');
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

// Process a single API endpoint with retry logic for reliability
const processEndpoint = async (endpoint, endpointIndex) => {
  try {
    const displayName = endpoint.name ? 
      `${endpoint.name} (${endpointIndex + 1})` : 
      `source ${endpointIndex + 1}`;
    
    // Construct query string for endpoint
    const queryString = Object.entries(endpoint.params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    // Fetch first page to get metadata and first batch of results
    const firstPageUrl = `${endpoint.url}?${queryString}&pageNum=1&_t=${Date.now()}`;
    console.error(`📥 Fetching ${displayName}, page 1...`);
    
    // Use region-specific headers
    const headers = getHeaders(endpoint.region);
    
    // Try up to 2 times with increasing timeouts
    let firstPageRes;
    let retries = 0;
    
    while (retries < 2) {
      try {
        firstPageRes = await fetchWithTimeout(
          firstPageUrl, 
          { headers }, 
          7000 + (retries * 2000)
        );
        break; // Success, exit retry loop
      } catch (err) {
        retries++;
        if (retries >= 2) throw err; // Max retries reached, rethrow
        console.error(`⚠️ Retry ${retries} for ${displayName}, page 1...`);
        await new Promise(r => setTimeout(r, 500)); // Wait before retry
      }
    }
    
    const firstPageData = firstPageRes.data?.data;
    
    if (!firstPageData || !firstPageData.tournaments || !Array.isArray(firstPageData.tournaments)) {
      console.error(`❌ No data from ${displayName}`);
      return [];
    }
    
    // Calculate total pages with endpoint-specific limits
    const totalEvents = firstPageData.totalNum || 0;
    const pageSize = parseInt(endpoint.params.pageSize || '50');
    let totalPages = Math.ceil(totalEvents / pageSize);
    
    // Hard limit on pages to prevent timeout - use the endpoint-specific maxPages
    totalPages = Math.min(totalPages, endpoint.maxPages || 3);
    
    console.error(`📊 ${displayName}: Found ${totalEvents} events across ${totalPages} pages (using ${Math.min(totalPages, endpoint.maxPages)} pages)`);
    
    // Store first page results
    let endpointTournaments = firstPageData.tournaments || [];
    
    // Only fetch additional pages if needed
    if (totalPages > 1) {
      // Fetch remaining pages sequentially
      for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
        const url = `${endpoint.url}?${queryString}&pageNum=${pageNum}&_t=${Date.now()}`;
        console.error(`📥 Fetching ${displayName}, page ${pageNum}...`);
        
        try {
          const response = await fetchWithTimeout(url, { headers }, 7000);
          const data = response.data?.data;
          
          if (data && data.tournaments && data.tournaments.length > 0) {
            console.error(`✅ ${displayName}, page ${pageNum}: ${data.tournaments.length} tournaments`);
            endpointTournaments = endpointTournaments.concat(data.tournaments);
          } else {
            console.error(`⚠️ ${displayName}, page ${pageNum}: No tournaments`);
          }
        } catch (pageError) {
          console.error(`❌ Failed to fetch ${displayName}, page ${pageNum}: ${pageError.message}`);
        }
        
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    console.error(`📊 ${displayName}: Collected ${endpointTournaments.length} tournaments`);
    return endpointTournaments;
  } catch (error) {
    console.error(`❌ Error processing endpoint ${endpointIndex + 1}: ${error.message}`);
    return [];
  }
};

// Improved batch processing with guaranteed progress
const fetchFromAllEndpoints = async () => {
  console.error(`📊 Starting Sportybet data collection from ${ALL_ENDPOINTS.length} endpoints...`);
  
  // Total number of tournaments collected
  let tournamentCount = 0;
  
  // To store all tournaments
  let allTournaments = [];
  
  // Create a pool with all endpoints and randomize order for better distribution
  const endpointPool = [...ALL_ENDPOINTS]
    .map(endpoint => ({ endpoint, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(item => item.endpoint);
  
  // Process endpoints in batches to avoid hitting rate limits
  const BATCH_SIZE = 3;
  const batches = Math.ceil(endpointPool.length / BATCH_SIZE);
  
  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, endpointPool.length);
    const currentBatch = endpointPool.slice(startIdx, endIdx);
    
    console.error(`📊 Processing batch ${batchIndex + 1}/${batches} (endpoints ${startIdx + 1}-${endIdx})...`);
    
    // Process batch in parallel for speed
    const batchPromises = currentBatch.map((endpoint, localIndex) => 
      processEndpoint(endpoint, startIdx + localIndex)
    );
    
    // Wait for current batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Process batch results
    let batchTournaments = 0;
    for (const tournaments of batchResults) {
      allTournaments = allTournaments.concat(tournaments);
      batchTournaments += tournaments.length;
      tournamentCount += tournaments.length;
    }
    
    console.error(`📊 Batch ${batchIndex + 1} collected ${batchTournaments} tournaments (total: ${tournamentCount})`);
    
    // Brief pause between batches to avoid rate limiting
    if (batchIndex < batches - 1) {
      console.error('Pausing briefly before next batch...');
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Early exit if we have enough data already
    if (tournamentCount > 100) {
      const estimatedEvents = tournamentCount * 10; // Each tournament has ~10 events on average
      if (estimatedEvents >= 1000) {
        console.error(`📊 Collected enough data (${tournamentCount} tournaments, ~${estimatedEvents} events). Proceeding to processing...`);
        break;
      }
    }
  }
  
  console.error(`📊 Total collected: ${allTournaments.length} tournaments`);
  return allTournaments;
};

// Enhanced event processing for better data quality
const processEvents = (tournaments) => {
  // Initialize a map to track unique events by ID
  const eventMap = new Map();
  const processed = { count: 0, skipped: 0 };
  
  console.error(`⚙️ Processing tournaments data...`);
  
  // First pass: process all tournaments to collect events
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
          
          // Check for different market formats
          const market = 
            event.markets?.find(m => m.id === "1" || m.name === "1X2") || 
            event.markets?.find(m => m.id === "18" || m.name === "Match Result");
          
          if (!market || !market.outcomes) {
            processed.skipped++;
            continue;
          }
          
          // Extract odds values with flexible matching
          let homeOdds = null;
          let drawOdds = null;
          let awayOdds = null;
          
          // Try multiple formats and patterns for outcome identification
          for (const outcome of market.outcomes) {
            if (!outcome) continue;
            
            // Convert outcome descriptor to lowercase string for comparison
            const desc = (outcome.desc || outcome.name || outcome.outcome || "").toString().toLowerCase();
            const outcomeName = (outcome.outcomeName || "").toString().toLowerCase();
            
            // Match home team odds
            if (desc.includes('home') || desc === '1' || desc.includes('1 ') || 
                outcomeName.includes('home') || desc.includes(event.homeTeamName.toLowerCase())) {
              homeOdds = outcome.odds;
            } 
            // Match draw odds
            else if (desc.includes('draw') || desc === 'x' || desc.includes('x ') || 
                    outcomeName.includes('draw')) {
              drawOdds = outcome.odds;
            } 
            // Match away team odds
            else if (desc.includes('away') || desc === '2' || desc.includes('2 ') || 
                    outcomeName.includes('away') || desc.includes(event.awayTeamName.toLowerCase())) {
              awayOdds = outcome.odds;
            }
          }
          
          // If we're still missing odds, try using position-based detection
          // (Some API responses just use positions instead of labels)
          if (!homeOdds || !drawOdds || !awayOdds) {
            const outcomes = market.outcomes;
            if (outcomes?.length === 3) {
              homeOdds = homeOdds || outcomes[0]?.odds;
              drawOdds = drawOdds || outcomes[1]?.odds;
              awayOdds = awayOdds || outcomes[2]?.odds;
            }
          }
          
          // Skip if any odds are missing
          if (!homeOdds || !drawOdds || !awayOdds) {
            processed.skipped++;
            continue;
          }
          
          // Format the start time 
          let startTime = null;
          
          if (event.estimateStartTime) {
            startTime = new Date(event.estimateStartTime).toISOString().slice(0, 16).replace('T', ' ');
          } else if (event.startTime) {
            startTime = new Date(event.startTime).toISOString().slice(0, 16).replace('T', ' ');
          }
            
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
          // If we already have this eventId, keep the record with the most recent data
          const existingEvent = eventMap.get(eventId);
          
          if (!existingEvent) {
            // New event, add it
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
  
  console.error(`✅ Successfully processed ${processed.count} valid events (skipped ${processed.skipped})`);
  return Array.from(eventMap.values());
};

const run = async () => {
  try {
    // Set a reasonable timeout for the entire operation (57 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Global timeout after 57 seconds")), 57000);
    });

    const tournamentPromise = fetchFromAllEndpoints();
    
    // Race between fetching data and timeout
    const tournaments = await Promise.race([tournamentPromise, timeoutPromise])
      .catch(error => {
        console.error(`Operation error: ${error.message}`);
        return [];
      });

    // Process tournaments into events with enhanced parsing
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