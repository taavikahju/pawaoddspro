#!/usr/bin/env node
const axios = require('axios');

// Configuration
const BASE_URL = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents';
const QUERY = 'sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&option=1';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.sportybet.com/'
};

// Fetch all pages of tournament data
const fetchAllPages = async () => {
  let allTournaments = [];
  let pageNum = 1;
  let totalPages = 1;
  let attempts = 0;
  const MAX_ATTEMPTS = 3;
  const MAX_PAGES = 20; // Safety limit

  while (pageNum <= totalPages && pageNum <= MAX_PAGES) {
    const url = `${BASE_URL}?${QUERY}&pageNum=${pageNum}&_t=${Date.now()}`;
    // Only log on the first page and every 5th page to reduce verbosity
    if (pageNum === 1 || pageNum % 5 === 0) {
      console.error(`📥 Fetching page ${pageNum}/${totalPages}...`);
    }

    try {
      const res = await axios.get(url, { 
        headers: HEADERS,
        timeout: 30000 // 30 second timeout
      });
      
      const data = res.data?.data;

      if (!data || !data.tournaments || !Array.isArray(data.tournaments)) {
        console.error(`❌ No valid tournaments found on page ${pageNum}`);
        
        // Only retry a few times, then move on
        if (++attempts >= MAX_ATTEMPTS) {
          console.error(`⚠️ Max retry attempts reached for page ${pageNum}, moving on...`);
          pageNum++;
          attempts = 0;
        }
        continue;
      }

      // Reset attempts counter after success
      attempts = 0;

      // On first page, calculate total pages
      if (pageNum === 1) {
        const totalNum = data.totalNum || 0;
        totalPages = Math.ceil(totalNum / 100);
        console.error(`📊 Found ${totalNum} total events across ${totalPages} pages`);
      }

      // Add tournaments to our collection
      allTournaments = allTournaments.concat(data.tournaments);
      // Skip tournament addition logs to reduce verbosity
      
      // Move to next page
      pageNum++;
      
      // Short pause between requests to be polite to the server
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`❌ Error on page ${pageNum}: ${err.message}`);
      
      // Retry a few times, then move on
      if (++attempts >= MAX_ATTEMPTS) {
        console.error(`⚠️ Max retry attempts reached for page ${pageNum}, moving on...`);
        pageNum++;
        attempts = 0;
      }
      
      // Longer pause after an error
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return allTournaments;
};

// Process the raw tournament data into our standardized format
const processTournaments = (tournaments) => {
  const processedEvents = [];
  let eventCount = 0;
  let skippedCount = 0;

  // Track progress (simplified log)
  console.error(`Processing ${tournaments.length} tournaments...`);
  
  for (const tournament of tournaments) {
    try {
      // Extract country and tournament name
      const country = tournament.events?.[0]?.sport?.category?.name || 'Unknown';
      const tournamentName = tournament.name || 'Unknown Tournament';
      
      if (!tournament.events || !Array.isArray(tournament.events)) {
        // Skip logging missing events to reduce verbosity
        continue;
      }
      
      // Process each event in the tournament
      for (const event of tournament.events) {
        try {
          // Basic validation
          if (!event.homeTeamName || !event.awayTeamName || !event.eventId) {
            skippedCount++;
            continue;
          }
          
          // Find the 1X2 market (home/draw/away)
          const market = event.markets?.find(m => m.id === "1");
          if (!market || !market.outcomes || !Array.isArray(market.outcomes)) {
            skippedCount++;
            continue;
          }
          
          // Extract odds from the outcomes
          const outcomes = market.outcomes.map(o => ({
            desc: o?.desc?.toString().toLowerCase() || '',
            odds: o?.odds ?? 0
          }));
          
          // Find the specific odds we need
          const homeOdds = outcomes.find(o => o.desc === 'home')?.odds || 0;
          const drawOdds = outcomes.find(o => o.desc === 'draw')?.odds || 0;
          const awayOdds = outcomes.find(o => o.desc === 'away')?.odds || 0;
          
          // Skip events with missing odds
          if (homeOdds === 0 && drawOdds === 0 && awayOdds === 0) {
            skippedCount++;
            continue;
          }
          
          // Format the start time
          let startTime = null;
          if (event.estimateStartTime) {
            const date = new Date(event.estimateStartTime);
            // Format to YYYY-MM-DD HH:MM
            startTime = date.toISOString().slice(0, 16).replace('T', ' ');
          }
          
          // Normalize the event ID by removing non-numeric characters (removing "sr:match:" prefix)
          const normalizedId = event.eventId.replace(/\D/g, '');
          
          // Add the processed event to our collection
          processedEvents.push({
            eventId: normalizedId,
            country: country,
            tournament: tournamentName,
            event: `${event.homeTeamName} - ${event.awayTeamName}`,
            market: "1X2",
            home_odds: homeOdds,
            draw_odds: drawOdds,
            away_odds: awayOdds,
            start_time: startTime
          });
          
          eventCount++;
        } catch (eventError) {
          // Skip individual event error logs to reduce verbosity
          skippedCount++;
          continue;
        }
      }
    } catch (tournamentError) {
      // Only log serious tournament errors
      if (tournamentError.message.includes('fatal') || tournamentError.message.includes('network')) {
        console.error(`❌ Error processing tournament: ${tournamentError.message}`);
      }
      continue;
    }
  }
  
  console.error(`✅ Successfully processed ${eventCount} events (skipped ${skippedCount})`);
  return processedEvents;
};

// Main function
const run = async () => {
  try {
    // Set a reasonable timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Global timeout after 120 seconds")), 120000);
    });
    
    // Fetch and process tournaments
    const tournamentPromise = fetchAllPages();
    
    // Race between fetching data and timeout
    const tournaments = await Promise.race([tournamentPromise, timeoutPromise])
      .catch(error => {
        console.error(`Operation error: ${error.message}`);
        return [];
      });
    
    // Process tournaments into our standardized format
    const events = processTournaments(tournaments);
    
    // Check if we got any events
    if (events.length === 0) {
      console.error('No valid events found');
      console.log(JSON.stringify([]));
      return;
    }
    
    // Log success
    const endTime = new Date();
    console.error(`[${endTime.toISOString()}] Sportybet scraper finished - ${events.length} events extracted`);
    
    // Output the events as JSON to stdout for the integration system
    console.log(JSON.stringify(events));
  } catch (error) {
    console.error('Fatal error in scraper:', error.message);
    console.log(JSON.stringify([]));
  }
};

// Start the scraper
run();