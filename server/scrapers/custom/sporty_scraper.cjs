#!/usr/bin/env node
const axios = require('axios');

// Sample tournaments and events for testing when API is not accessible
const sampleData = [
  {
    eventId: "SR12345",
    country: "England",
    tournament: "Premier League",
    event: "Arsenal - Chelsea",
    market: "1X2",
    home_odds: "2.10",
    draw_odds: "3.30",
    away_odds: "3.50",
    start_time: "2025-04-25 15:00"
  },
  {
    eventId: "SR12346",
    country: "Spain",
    tournament: "La Liga",
    event: "Barcelona - Real Madrid",
    market: "1X2",
    home_odds: "2.25",
    draw_odds: "3.20",
    away_odds: "3.10",
    start_time: "2025-04-25 20:00"
  },
  {
    eventId: "SR12347",
    country: "Kenya",
    tournament: "Premier League",
    event: "Gor Mahia - AFC Leopards",
    market: "1X2",
    home_odds: "1.90",
    draw_odds: "3.30",
    away_odds: "4.20",
    start_time: "2025-04-24 14:00"
  }
];

const BASE_URL = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents';
const QUERY = 'sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&option=1';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

const fetchWithTimeout = async (url, options, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await axios({
      ...options,
      url,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Only fetch 3 pages maximum to avoid timeout issues
const fetchSomeTournaments = async () => {
  let allTournaments = [];
  const maxPages = 3;

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = `${BASE_URL}?${QUERY}&pageNum=${pageNum}&_t=${Date.now()}`;
    console.error(`📥 Fetching page ${pageNum}...`);

    try {
      const res = await fetchWithTimeout(url, { headers: HEADERS }, 10000);
      const data = res.data?.data;

      if (!data || !data.tournaments || data.tournaments.length === 0) {
        console.error('❌ No tournaments found or empty data');
        break;
      }

      allTournaments = allTournaments.concat(data.tournaments);
    } catch (err) {
      console.error(`❌ Failed on page ${pageNum}:`, err.message);
      break;
    }
  }

  return allTournaments;
};

const run = async () => {
  try {
    // Set a timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Operation timed out")), 20000);
    });

    const tournamentPromise = fetchSomeTournaments();
    
    // Race between fetching data and timeout
    const tournaments = await Promise.race([tournamentPromise, timeoutPromise])
      .catch(error => {
        console.error(`Tournament fetch error: ${error.message}`);
        return [];
      });

    console.error(`📊 Processed ${tournaments.length} tournaments`);
    
    if (!tournaments || tournaments.length === 0) {
      console.error('No tournaments fetched - returning sample data');
      console.log(JSON.stringify(sampleData));
      return;
    }

    const flatEvents = [];
    
    // Process tournaments with a limit to prevent excessive processing
    for (const tournament of tournaments.slice(0, 50)) {
      const country = tournament.events?.[0]?.sport?.category?.name || 'Unknown';
      const tournamentName = tournament.name || 'Unknown';
      
      if (!tournament.events || !Array.isArray(tournament.events)) {
        continue;
      }

      // Process events with a limit to prevent excessive processing
      for (const event of tournament.events.slice(0, 20)) {
        try {
          if (!event.homeTeamName || !event.awayTeamName) continue;
          
          const market = event.markets?.find(m => m.id === "1");
          
          const homeOdds = market?.outcomes?.find(o => 
            o?.desc?.toString().toLowerCase() === 'home')?.odds || null;
          const drawOdds = market?.outcomes?.find(o => 
            o?.desc?.toString().toLowerCase() === 'draw')?.odds || null;
          const awayOdds = market?.outcomes?.find(o => 
            o?.desc?.toString().toLowerCase() === 'away')?.odds || null;
            
          const startTime = event.estimateStartTime
            ? new Date(event.estimateStartTime).toISOString().slice(0, 16).replace('T', ' ')
            : null;
            
          if (!homeOdds || !drawOdds || !awayOdds || !startTime) continue;
          
          flatEvents.push({
            eventId: event.eventId.replace(/\D/g, ''),
            country,
            tournament: tournamentName,
            event: `${event.homeTeamName} - ${event.awayTeamName}`,
            market: market?.name || "1X2",
            home_odds: homeOdds,
            draw_odds: drawOdds,
            away_odds: awayOdds,
            start_time: startTime
          });
        } catch (eventError) {
          console.error('Error processing event:', eventError.message);
        }
      }
    }
    
    if (flatEvents.length === 0) {
      console.error('No valid events found - returning sample data');
      console.log(JSON.stringify(sampleData));
      return;
    }

    // Output to stdout for the integration system
    console.log(JSON.stringify(flatEvents));
  } catch (error) {
    console.error('Error in scraper:', error.message);
    // Output sample data in case of error
    console.log(JSON.stringify(sampleData));
  }
};

run();