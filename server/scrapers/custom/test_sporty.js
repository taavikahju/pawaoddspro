const axios = require("axios");
#!/usr/bin/env node
const axios = require('axios');

// ==== CONFIGURATION ====
// SportyBet API country codes to use for scraping
const REGIONS = ['gh', 'ke', 'ng', 'tz', 'ug', 'za'];

// Configure endpoints focusing on reliability and responsiveness
const buildEndpoints = () => {
  const endpoints = [];
  
  // Add more regions for better coverage
  for (const region of REGIONS) {
    // Main upcoming events - most comprehensive source
    endpoints.push({
      url: `https://www.sportybet.com/api/${region}/factsCenter/pcUpcomingEvents`,
      params: {
        sportId: 'sr:sport:1',
        marketId: '1',
        pageSize: '200',
        option: '1'
      },
      region: region,
      maxPages: 10,
      priority: region === 'gh' || region === 'ke' ? 1 : 2 // Higher priority for main regions
    });
    
    // Today's matches - has most immediate matches
    endpoints.push({
      url: `https://www.sportybet.com/api/${region}/factsCenter/pcToday`,
      params: {
        sportId: 'sr:sport:1',
        marketId: '1',
        pageSize: '200', 
        option: '1'
      },
      region: region,
      maxPages: 5,
      priority: region === 'gh' || region === 'ke' ? 1 : 2
    });
    
    // Popular leagues - has key matches that people bet on most
    endpoints.push({
      url: `https://www.sportybet.com/api/${region}/factsCenter/pcPopularLeague`,
      params: {
        sportId: 'sr:sport:1',
        marketId: '1', 
        option: '1'
      },
      region: region,
      maxPages: 3,
      priority: region === 'gh' || region === 'ke' ? 1 : 2
    });
    
    // Add dynamic endpoint for inPlay matches - critical for live odds
    endpoints.push({
      url: `https://www.sportybet.com/api/${region}/factsCenter/schedule/inPlay`,
      params: {
        sportId: 1
      },
      region: region,
      maxPages: 1,
      priority: 1 // Highest priority for live matches
    });
    
    // Add live score endpoint that sometimes has different events
    endpoints.push({
      url: `https://www.sportybet.com/api/${region}/fact/livescore`,
      params: {
        sportId: 1
      },
      region: region,
      maxPages: 1,
      priority: 1 // Highest priority for live scores
    });
  }
  
  // Include popular countries for better coverage
  const popularCountryCategories = [
    { id: 'sr:category:1', name: 'England' },    // England (most popular)
    { id: 'sr:category:2', name: 'Spain' },      // Spain (La Liga)
    { id: 'sr:category:3', name: 'France' },     // France (Ligue 1)
    { id: 'sr:category:4', name: 'Germany' },    // Germany (Bundesliga)
    { id: 'sr:category:5', name: 'Italy' },      // Italy (Serie A)
    { id: 'sr:category:13', name: 'Ghana' },     // Ghana (local focus)
    { id: 'sr:category:45', name: 'Kenya' },     // Kenya (local focus)
    { id: 'sr:category:31', name: 'Nigeria' }    // Nigeria (local focus)
  ];
  
  // Add these key country endpoints for more thorough coverage
  popularCountryCategories.forEach(country => {
    endpoints.push({
      url: 'https://www.sportybet.com/api/gh/factsCenter/pcCategory',
      params: {
        sportId: 'sr:sport:1',
        categoryId: country.id,
        marketId: '1',
        pageSize: '200',
        option: '1'
      },
      region: 'gh',
      name: country.name,
      maxPages: 4,
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
const fetchWithTimeout = async (url, options, timeout = 10000) => {
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
  const ENDPOINT_TIMEOUT = 20000; // 20 seconds max per endpoint
  
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
          
        // Add timestamp to avoid caching
        const timestamp = Date.now();
        
        // Fetch first page to get metadata and first batch of results
        const firstPageUrl = `${endpoint.url}?${queryString}&pageNum=1&_t=${timestamp}`;
        console.error(`📥 Fetching ${displayName}, page 1...`);
        
        // Use region-specific headers
        const headers = getHeaders(endpoint.region);
        
        // Try up to 3 times with increasing timeouts
        let firstPageRes;
        let retries = 0;
        
        while (retries < 3) {
          try {
            firstPageRes = await fetchWithTimeout(
              firstPageUrl, 
              { headers }, 
              10000 + (retries * 2000)
            );
            break; // Success, exit retry loop
          } catch (err) {
            retries++;
            if (retries >= 3) throw err; // Max retries reached, rethrow
            console.error(`⚠️ Retry ${retries} for ${displayName}, page 1...`);
            await new Promise(r => setTimeout(r, 500)); // Wait before retry
          }
        }
        
        // Handle different response formats
        let firstPageData;
        let endpointTournaments = [];
        
        // Try to extract tournaments from different API endpoint structures
        if (firstPageRes.data?.data?.tournaments) {
          // Standard format with tournaments
          firstPageData = firstPageRes.data.data;
          endpointTournaments = firstPageData.tournaments || [];
        } else if (firstPageRes.data?.data?.events || firstPageRes.data?.data?.matches) {
          // Inplay or livescore format - need to convert to tournament-like structure
          const events = firstPageRes.data.data.events || firstPageRes.data.data.matches || [];
          
          if (events.length > 0) {
            console.error(`📊 ${displayName}: Found ${events.length} events in special format`);
            
            // Group events by tournament to create fake tournament structure
            const tournamentsMap = {};
            
            events.forEach(event => {
              const tournamentId = event.tournamentId || event.leagueId || 'unknown';
              const tournamentName = event.tournament?.name || event.league?.name || 'Unknown Tournament';
              
              if (!tournamentsMap[tournamentId]) {
                tournamentsMap[tournamentId] = {
                  id: tournamentId,
                  name: tournamentName,
                  events: []
                };
              }
              
              tournamentsMap[tournamentId].events.push(event);
            });
            
            endpointTournaments = Object.values(tournamentsMap);
            console.error(`📊 ${displayName}: Converted to ${endpointTournaments.length} tournaments`);
          }
        } else if (firstPageRes.data?.data && Array.isArray(firstPageRes.data.data)) {
          // Array format for some endpoints
          const events = firstPageRes.data.data;
          console.error(`📊 ${displayName}: Found array of ${events.length} events`);
          
          // Create a single tournament to hold all events
          endpointTournaments = [{
            id: 'combined',
            name: 'Combined Results',
            events: events
          }];
        } else {
          console.error(`❌ Unknown data format from ${displayName}`);
          resolve([]);
          return;
        }
        
        if (endpointTournaments.length === 0) {
          console.error(`❌ No tournaments found from ${displayName}`);
          resolve([]);
          return;
        }
        
        // Store initial results
        collectedTournaments = [...endpointTournaments];
        
        // Check if we need to fetch more pages
        let totalPages = 1;
        
        if (firstPageData && firstPageData.totalNum) {
          const totalEvents = firstPageData.totalNum || 0;
          const pageSize = parseInt(endpoint.params.pageSize || '50');
          totalPages = Math.ceil(totalEvents / pageSize);
          
          // Hard limit on pages to prevent timeout
          totalPages = Math.min(totalPages, endpoint.maxPages || 3);
          
          console.error(`📊 ${displayName}: Found ${totalEvents} events across ${totalPages} pages (using ${Math.min(totalPages, endpoint.maxPages)} pages)`);
        }
        
        // Only fetch additional pages if needed
        if (totalPages > 1) {
          // Fetch remaining pages sequentially
          for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
            const url = `${endpoint.url}?${queryString}&pageNum=${pageNum}&_t=${Date.now()}`;
            console.error(`📥 Fetching ${displayName}, page ${pageNum}...`);
            
            try {
              const response = await fetchWithTimeout(url, { headers }, 10000);
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
            await new Promise(resolve => setTimeout(resolve, 200));
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
  // These are processed in parallel for maximum coverage
  const highPriorityEndpoints = sortedEndpoints.filter(e => (e.priority || 999) === 1);
  console.error(`📊 Processing ${highPriorityEndpoints.length} high-priority endpoints in parallel...`);
  
  // Process high priority endpoints in parallel for better performance
  const highPriorityPromises = highPriorityEndpoints.map((endpoint, i) => {
    return processEndpoint(endpoint, i);
  });
  
  // Collect results from high priority endpoints
  const highPriorityResults = await Promise.all(highPriorityPromises);
  
  // Flatten and add to our allTournaments array
  for (const tournaments of highPriorityResults) {
    if (tournaments && tournaments.length > 0) {
      allTournaments = allTournaments.concat(tournaments);
      tournamentCount += tournaments.length;
      
      // Also save to fetchedSources for potentially more data
      fetchedSources = fetchedSources.concat(tournaments);
    }
  }
  
  console.error(`📊 High priority endpoints collected ${tournamentCount} tournaments`);
  
  // If high priority endpoints provided enough data, we can skip the rest
  if (tournamentCount >= 20) {
    const estimatedEvents = tournamentCount * 10; // Each tournament has ~10 events on average
    console.error(`📊 High priority endpoints collected ${tournamentCount} tournaments (~${estimatedEvents} events)`);
  } else {
    // Process remaining endpoints in small batches
    const remainingEndpoints = sortedEndpoints.filter(e => (e.priority || 999) > 1);
    if (remainingEndpoints.length > 0) {
      console.error(`📊 Processing ${remainingEndpoints.length} remaining endpoints in batches...`);
      
      // Process endpoints in smaller batches to avoid rate limits
      const BATCH_SIZE = 3; // Increase batch size for better coverage
      const batches = Math.ceil(remainingEndpoints.length / BATCH_SIZE);
      
      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, remainingEndpoints.length);
        const currentBatch = remainingEndpoints.slice(startIdx, endIdx);
        
        console.error(`📊 Processing batch ${batchIndex + 1}/${batches} (endpoints ${startIdx + 1}-${endIdx})...`);
        
        // Process batch in parallel for better coverage
        const batchPromises = currentBatch.map((endpoint, i) => {
          return processEndpoint(endpoint, startIdx + i);
        });
        
        // Collect results from batch
        const batchResults = await Promise.all(batchPromises);
        
        // Add batch results to our collection
        for (const tournaments of batchResults) {
          if (tournaments && tournaments.length > 0) {
            allTournaments = allTournaments.concat(tournaments);
            tournamentCount += tournaments.length;
            
            // Also save to fetchedSources for potentially more data
            fetchedSources = fetchedSources.concat(tournaments);
          }
        }
        
        // Brief pause between batches
        if (batchIndex < batches - 1) {
          console.error('Pausing briefly before next batch...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
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
          
          const eventId = event.eventId.toString();
          
          // Check if we've already processed this event with better data
          if (eventMap.has(eventId)) {
            const existingEvent = eventMap.get(eventId);
            // Only skip if existing event has valid odds
            if (existingEvent.home_odds && existingEvent.draw_odds && existingEvent.away_odds) {
              continue;
            }
          }
          
          // Parse start time
          let startTimeStr = event.startTime;
          if (!startTimeStr && event.startTimeFormat) {
            startTimeStr = event.startTimeFormat;
          }
          
          let startTime;
          try {
            startTime = new Date(startTimeStr).toISOString();
          } catch (e) {
            startTime = new Date().toISOString();
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
          
          // Some APIs have outcomes in a specific order - try this as fallback
          if (!homeOdds || !drawOdds || !awayOdds) {
            const outcomes = market.outcomes;
            if (outcomes?.length === 3) {
              homeOdds = homeOdds || outcomes[0]?.odds;
              drawOdds = drawOdds || outcomes[1]?.odds;
              awayOdds = awayOdds || outcomes[2]?.odds;
            }
          }
          
          // Only process events with complete odds sets
          if (!homeOdds || !drawOdds || !awayOdds) {
            processed.skipped++;
            continue;
          }
          
          // Create clean event object in standardized format
          const eventKey = `${event.homeTeamName} vs ${event.awayTeamName}`;
          
          eventMap.set(eventId, {
            eventId,
            id: eventId,
            sport: 'football',
            teams: `${event.homeTeamName} vs ${event.awayTeamName}`,
            league: tournamentName,
            home_team: event.homeTeamName,
            away_team: event.awayTeamName,
            date: startTime.split('T')[0],
            time: startTime.split('T')[1].split('.')[0],
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
    // Main timeout: 60 seconds to allow more time for processing
    const MAIN_TIMEOUT = 60000;
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