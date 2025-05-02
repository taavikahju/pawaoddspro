#!/usr/bin/env node
const axios = require('axios');

// Configuration
const BASE_URL = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents';
const QUERY = 'sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&option=1';

// Add specific endpoint for England Premier League
// categoryIds are the IDs for specific tournaments/categories in Sportybet
const EPL_URL = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcoming';
const EPL_QUERY = 'sportId=sr%3Asport%3A1&categoryIds=sr%3Acategory%3A1&tournamentIds=sr%3Atournament%3A17&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.sportybet.com/'
};

// Helper function to fetch data from a URL with retry logic
const fetchWithRetry = async (url, description, maxAttempts = 3) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      console.error(`📥 Fetching ${description}...`);
      const res = await axios.get(url, { 
        headers: HEADERS,
        timeout: 30000 // 30 second timeout
      });
      
      return res.data?.data;
    } catch (err) {
      attempts++;
      console.error(`❌ Error fetching ${description} (attempt ${attempts}/${maxAttempts}): ${err.message}`);
      
      if (attempts >= maxAttempts) {
        console.error(`⚠️ Max retry attempts reached for ${description}`);
        return null;
      }
      
      // Longer pause after an error
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return null;
};

// Fetch England Premier League events specifically
const fetchEplEvents = async () => {
  console.error(`🏴󠁧󠁢󠁥󠁮󠁧󠁿 Fetching England Premier League events specifically...`);
  const eplEvents = [];
  
  try {
    // Fetch the EPL-specific endpoint
    const eplUrl = `${EPL_URL}?${EPL_QUERY}&_t=${Date.now()}`;
    const data = await fetchWithRetry(eplUrl, "England Premier League events");
    
    if (!data) {
      console.error(`⚠️ Could not fetch England Premier League events`);
      return [];
    }
    
    // Process the EPL-specific data
    if (data.tournaments && Array.isArray(data.tournaments)) {
      console.error(`✅ Found ${data.tournaments.length} EPL tournament(s)`);
      
      for (const tournament of data.tournaments) {
        if (tournament.events && Array.isArray(tournament.events)) {
          console.error(`✅ Found ${tournament.events.length} total EPL events for tournament: ${tournament.name}`);
          
          // Tag these events as EPL specifically
          tournament.isEPL = true;
          eplEvents.push(tournament);
        }
      }
    }
    
    return eplEvents;
  } catch (error) {
    console.error(`❌ Error fetching EPL events: ${error.message}`);
    return [];
  }
};

// Fetch all pages of tournament data
const fetchAllPages = async () => {
  let allTournaments = [];
  let pageNum = 1;
  let totalPages = 1;
  let attempts = 0;
  const MAX_ATTEMPTS = 3;
  const MAX_PAGES = 20; // Safety limit

  // First, fetch England Premier League events specifically
  const eplTournaments = await fetchEplEvents();
  
  // Add EPL tournaments to our collection
  if (eplTournaments.length > 0) {
    allTournaments = allTournaments.concat(eplTournaments);
    console.error(`✅ Added ${eplTournaments.length} EPL tournament(s) to collection`);
  }

  // Now fetch all other tournaments
  console.error(`📊 Fetching general tournaments data...`);
  
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
  
  // Special event ID to track
  const SPECIAL_EVENT_ID = '50850679';
  let specialEventFound = false;
  
  // Add specific tracking for England Premier League
  const eplEvents = {
    found: 0,
    withOdds: 0,
    dates: new Set(),
    teams: []
  };

  // Track progress (simplified log)
  console.error(`Processing ${tournaments.length} tournaments...`);
  
  for (const tournament of tournaments) {
    try {
      // Extract country and tournament name
      const country = tournament.events?.[0]?.sport?.category?.name || 'Unknown';
      const tournamentName = tournament.name || 'Unknown Tournament';
      
      // Check if this is EPL
      const isEPL = (country === 'England' && 
                     (tournamentName.includes('Premier League') || 
                      tournamentName.includes('Premier league')));
      
      if (isEPL) {
        console.error(`🏴󠁧󠁢󠁥󠁮󠁧󠁿 Found England Premier League tournament: ${tournamentName}`);
      }
      
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
            
            // Track EPL events without odds
            if (isEPL) {
              console.error(`❌ EPL event without markets: ${event.homeTeamName} vs ${event.awayTeamName} (ID: ${event.eventId})`);
            }
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
            
            // Track EPL events without odds
            if (isEPL) {
              console.error(`❌ EPL event with zero odds: ${event.homeTeamName} vs ${event.awayTeamName} (ID: ${event.eventId})`);
            }
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
          // Store both the original ID and the normalized version to help with matching
          const normalizedId = event.eventId.replace(/\D/g, '');
          const originalId = event.eventId;
          
          // Check if this is our special tracked event
          if (normalizedId === SPECIAL_EVENT_ID || originalId.includes(SPECIAL_EVENT_ID)) {
            specialEventFound = true;
            console.error(`\n🔍 FOUND SPECIAL EVENT ID ${SPECIAL_EVENT_ID}:`);
            console.error(`- Teams: ${event.homeTeamName} vs ${event.awayTeamName}`);
            console.error(`- Original ID: ${originalId}`);
            console.error(`- Normalized ID: ${normalizedId}`);
            console.error(`- Country: ${country}`);
            console.error(`- Tournament: ${tournamentName}`);
            console.error(`- Odds: Home=${homeOdds}, Draw=${drawOdds}, Away=${awayOdds}`);
            console.error(`- Start Time: ${startTime}`);
            console.error(`- Is EPL: ${isEPL}`);
            console.error(``);
          }
          
          // Track EPL events
          if (isEPL) {
            eplEvents.found++;
            eplEvents.withOdds++;
            if (startTime) eplEvents.dates.add(startTime.split(' ')[0]); // Just the date part
            eplEvents.teams.push({
              teams: `${event.homeTeamName} - ${event.awayTeamName}`,
              date: startTime,
              eventId: originalId, 
              normalizedId,
              odds: { home: homeOdds, draw: drawOdds, away: awayOdds }
            });
          }
          
          // Add the processed event to our collection
          processedEvents.push({
            eventId: normalizedId,
            originalEventId: originalId, // Store the original ID for better matching
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
  
  // Log EPL specific stats
  if (eplEvents.found > 0) {
    console.error(`\n🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLAND PREMIER LEAGUE SUMMARY:`);
    console.error(`- Found ${eplEvents.found} total EPL events`);
    console.error(`- ${eplEvents.withOdds} events have valid odds`);
    console.error(`- Dates covered: ${Array.from(eplEvents.dates).sort().join(', ')}`);
    console.error(`- Teams and dates:`);
    
    // Sort by date for easier inspection
    eplEvents.teams.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });
    
    // Print team information grouped by date
    let currentDate = '';
    for (const team of eplEvents.teams) {
      const date = team.date ? team.date.split(' ')[0] : 'Unknown date';
      if (date !== currentDate) {
        console.error(`\n  ${date}:`);
        currentDate = date;
      }
      console.error(`  - ${team.teams} (ID: ${team.normalizedId}) Odds: ${team.odds.home}/${team.odds.draw}/${team.odds.away}`);
    }
    console.error(''); // Empty line for better readability
  }
  
  // Report on our special event tracking
  if (!specialEventFound) {
    console.error(`\n⚠️ SPECIAL EVENT ID ${SPECIAL_EVENT_ID} WAS NOT FOUND in any tournament!`);
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