#!/usr/bin/env node
const axios = require('axios');

// ==== CONFIGURATION ====
// Primary Sportybet API country code - focusing on the most reliable regions 
// Based on testing, Ghana (gh) and Kenya (ke) are most reliable
const REGIONS = ['gh', 'ke'];

// Configure endpoints focusing on reliability and responsiveness
const buildEndpoints = () => {
  const endpoints = [];
  
  // Only use the most reliable endpoints to avoid rate limiting and timeouts
  // Ghana API is the most stable and provides most of the data
  endpoints.push(
    // Main upcoming events - most comprehensive source
    {
      url: 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents',
      params: {
        sportId: 'sr:sport:1',
        marketId: '1',
        pageSize: '100',
        option: '1'
      },
      region: 'gh',
      maxPages: 15, // Increase page limit to get more events
      priority: 1   // Highest priority - critical endpoint
    },
    // Today's matches - has most immediate matches
    {
      url: 'https://www.sportybet.com/api/gh/factsCenter/pcToday',
      params: {
        sportId: 'sr:sport:1',
        marketId: '1',
        pageSize: '100',
        option: '1'
      },
      region: 'gh',
      maxPages: 5,
      priority: 1
    },
    // Popular leagues - has key matches that people bet on most
    {
      url: 'https://www.sportybet.com/api/gh/factsCenter/pcPopularLeague',
      params: {
        sportId: 'sr:sport:1',
        marketId: '1', 
        option: '1'
      },
      region: 'gh',
      maxPages: 3,
      priority: 1
    }
  );
  
  // Add Kenya API as backup source - often has different events
  endpoints.push(
    {
      url: 'https://www.sportybet.com/api/ke/factsCenter/pcUpcomingEvents',
      params: {
        sportId: 'sr:sport:1',
        marketId: '1',
        pageSize: '100',
        option: '1'
      },
      region: 'ke',
      maxPages: 10,
      priority: 2
    }
  );
  
  // Only include the most important countries to avoid too many API calls
  const majorCountryCategories = [
    { id: 'sr:category:1', name: 'England' },    // England (most popular)
    { id: 'sr:category:13', name: 'Ghana' },     // Ghana (local focus)
    { id: 'sr:category:45', name: 'Kenya' }      // Kenya (local focus)
  ];
  
  // Add these key country endpoints
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
      maxPages: 3,
      priority: 3
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
  // Create an individual timeout for this endpoint
  const ENDPOINT_TIMEOUT = 15000; // 15 seconds max per endpoint
  
  // To store tournaments as we collect them (for partial results)
  let collectedTournaments = [];
  
  // Wrap everything in a Promise.race to handle timeouts gracefully
  try {
    // Create the timeout promise
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        console.error(`⏱️ Endpoint timeout reached for endpoint ${endpointIndex + 1} - returning partial data (${collectedTournaments.length} tournaments)`);
        resolve(collectedTournaments); // Return whatever we've collected so far
      }, ENDPOINT_TIMEOUT);
    });
    
    // Create the actual processing promise
    const processingPromise = new Promise(async (resolve, reject) => {
      try {
        // Create a display name for logs
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
          resolve([]);
          return;
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
        
        // Update our partial results with the first page data
        collectedTournaments = [...endpointTournaments];
        
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
                
                // Update our partial results with new page data
                collectedTournaments = [...endpointTournaments];
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
        resolve(endpointTournaments);
      } catch (error) {
        console.error(`❌ Error processing endpoint ${endpointIndex + 1}: ${error.message}`);
        // If we have some partial data, return it instead of rejecting
        if (collectedTournaments.length > 0) {
          console.error(`Using ${collectedTournaments.length} tournaments collected before error`);
          resolve(collectedTournaments);
        } else {
          resolve([]);
        }
      }
    });
    
    // Race between processing and timeout - return whichever completes first
    return await Promise.race([processingPromise, timeoutPromise]);
  } catch (error) {
    console.error(`Fatal error in endpoint ${endpointIndex + 1}: ${error.message}`);
    return collectedTournaments.length > 0 ? collectedTournaments : []; // Return whatever we've collected or empty array
  }
};

// Shared variables to store partial results
let highPriorityResults = [];
let fetchedSources = [];

// Prioritized data collection with resilience
const fetchFromAllEndpoints = async () => {
  console.error(`📊 Starting Sportybet data collection from ${ALL_ENDPOINTS.length} endpoints...`);
  
  // Total number of tournaments collected
  let tournamentCount = 0;
  
  // To store all tournaments
  let allTournaments = [];
  
  // Reset partial results storage for this run
  highPriorityResults = [];
  fetchedSources = [];
  
  // Sort endpoints by priority to ensure critical ones are processed first
  const sortedEndpoints = [...ALL_ENDPOINTS].sort((a, b) => {
    // Sort by priority first (lower number = higher priority)
    const priorityDiff = (a.priority || 999) - (b.priority || 999);
    if (priorityDiff !== 0) return priorityDiff;
    
    // If same priority, sort by region to group related endpoints
    return (a.region || '').localeCompare(b.region || '');
  });
  
  // Process high priority endpoints first (priority 1) - these are critical
  // These are processed one at a time for maximum reliability
  const highPriorityEndpoints = sortedEndpoints.filter(e => (e.priority || 999) === 1);
  console.error(`📊 Processing ${highPriorityEndpoints.length} high-priority endpoints first...`);
  
  for (let i = 0; i < highPriorityEndpoints.length; i++) {
    const endpoint = highPriorityEndpoints[i];
    const displayName = endpoint.name || `high-priority source ${i+1}`;
    
    console.error(`📊 Processing critical endpoint: ${displayName}...`);
    try {
      // Process each high priority endpoint with robust error handling
      const tournaments = await processEndpoint(endpoint, i);
      
      // Store high priority results separately to use if timeouts occur
      highPriorityResults = highPriorityResults.concat(tournaments);
      
      allTournaments = allTournaments.concat(tournaments);
      tournamentCount += tournaments.length;
      
      // Also save to fetchedSources for potentially more data
      fetchedSources = fetchedSources.concat(tournaments);
      
      console.error(`📊 Critical endpoint ${displayName} collected ${tournaments.length} tournaments (total: ${tournamentCount})`);
      
      // Brief pause between high priority endpoints
      if (i < highPriorityEndpoints.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    } catch (error) {
      console.error(`❌ Failed to process critical endpoint ${displayName}: ${error.message}`);
    }
  }
  
  // If high priority endpoints provided enough data, we can skip the rest
  if (tournamentCount > 50) {
    const estimatedEvents = tournamentCount * 10; // Each tournament has ~10 events on average
    console.error(`📊 High priority endpoints collected ${tournamentCount} tournaments (~${estimatedEvents} events)`);
  }
  
  // Process remaining endpoints in small batches
  const remainingEndpoints = sortedEndpoints.filter(e => (e.priority || 999) > 1);
  if (remainingEndpoints.length > 0) {
    console.error(`📊 Processing ${remainingEndpoints.length} remaining endpoints in batches...`);
    
    // Process endpoints in smaller batches to avoid rate limits
    const BATCH_SIZE = 2; // Reduce batch size for better reliability
    const batches = Math.ceil(remainingEndpoints.length / BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, remainingEndpoints.length);
      const currentBatch = remainingEndpoints.slice(startIdx, endIdx);
      
      console.error(`📊 Processing batch ${batchIndex + 1}/${batches} (endpoints ${startIdx + 1}-${endIdx})...`);
      
      // Process batch sequentially for better reliability
      for (let i = 0; i < currentBatch.length; i++) {
        const endpoint = currentBatch[i];
        const endpointIdx = startIdx + i;
        const displayName = endpoint.name || `source ${endpointIdx + 1}`;
        
        try {
          // Process each endpoint sequentially
          const tournaments = await processEndpoint(endpoint, endpointIdx);
          allTournaments = allTournaments.concat(tournaments);
          tournamentCount += tournaments.length;
          
          // Also save to fetchedSources for potentially more data during timeouts
          fetchedSources = fetchedSources.concat(tournaments);
          
          console.error(`📊 Endpoint ${displayName} collected ${tournaments.length} tournaments (total: ${tournamentCount})`);
          
          // Brief pause between endpoints in the same batch
          if (i < currentBatch.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        } catch (error) {
          console.error(`❌ Failed to process endpoint ${displayName}: ${error.message}`);
        }
      }
      
      // Brief pause between batches
      if (batchIndex < batches - 1) {
        console.error('Pausing briefly before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    // Set multiple timeouts for different phases of operation
    // Main timeout: 45 seconds to allow time for processing
    const MAIN_TIMEOUT = 45000;
    let fetchedTournaments = [];
    
    // Create a timeout promise that resolves with the best available partial data
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        console.error(`⏱️ Global timeout after ${MAIN_TIMEOUT/1000} seconds - using best available data`);
        
        // Determine which data to use based on what we've collected
        if (highPriorityResults.length > 20) {
          console.error(`✓ Using partial data from ${highPriorityResults.length} high-priority sources`);
          resolve(highPriorityResults);
        } else if (fetchedSources.length > 0) {
          console.error(`✓ Using partial data from ${fetchedSources.length} sources`);
          resolve(fetchedSources);
        } else {
          console.error(`❌ No partial data available`);
          resolve([]);
        }
      }, MAIN_TIMEOUT);
    });

    // Start fetching data
    const tournamentPromise = fetchFromAllEndpoints();
    
    // Race between fetching data and timeout
    fetchedTournaments = await Promise.race([tournamentPromise, timeoutPromise]);
    
    // If tournamentPromise finished but gave us an empty array, check our backup data
    if (fetchedTournaments.length === 0) {
      console.error('No tournaments collected from primary method, checking backups');
      
      if (highPriorityResults.length > 0) {
        console.error(`✓ Using backup data from ${highPriorityResults.length} high-priority sources`);
        fetchedTournaments = highPriorityResults;
      } else if (fetchedSources.length > 0) {
        console.error(`✓ Using backup data from ${fetchedSources.length} sources`);
        fetchedTournaments = fetchedSources;
      }
    }

    // Process tournaments into events with enhanced parsing
    // If we hit the global timeout, prioritize processing what we have
    const events = processEvents(fetchedTournaments);
    
    if (events.length === 0) {
      console.error('No valid events found');
      console.log(JSON.stringify([]));
      return;
    }
    
    // Check if we have partial data vs complete data 
    const isPartialData = fetchedTournaments === highPriorityResults || fetchedTournaments === fetchedSources;
    
    console.error(`✅ Successfully extracted ${events.length} valid events${isPartialData ? ' (partial data due to timeout)' : ''}`);
    
    // Output to stdout for the integration system
    console.log(JSON.stringify(events));
  } catch (error) {
    console.error('Fatal error in scraper:', error.message);
    console.log(JSON.stringify([]));
  }
};

// Let's go!
run();