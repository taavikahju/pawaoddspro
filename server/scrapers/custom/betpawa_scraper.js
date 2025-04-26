/**
 * BetPawa Dedicated Live Events Scraper
 * This is a dedicated scraper for BetPawa that uses the proper API endpoints
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE = 'https://www.betpawa.com.gh';
const FOOTBALL_ID = 2; // Sport ID for football/soccer

// Match tracking
let matchCache = new Map();
let lastRequestTime = 0;
const REQUEST_DELAY = 1000; // Delay between requests, in milliseconds

/**
 * Main scraping function to fetch live football matches
 */
async function getLiveMatches() {
  try {
    console.log('Fetching live football matches from BetPawa Ghana...');
    const events = await fetchCategories();
    
    if (events && events.length > 0) {
      console.log(`Found ${events.length} live football matches from BetPawa Ghana`);
      const timestamp = new Date().toISOString();
      return processEvents(events, timestamp);
    } else {
      console.log('No live events found');
      return [];
    }
  } catch (error) {
    console.error('Error fetching live matches:', error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', JSON.stringify(error.response.data));
    }
    return [];
  }
}

/**
 * Fetch football categories (competitions) from the API
 */
async function fetchCategories() {
  try {
    // Ensure we don't make requests too quickly
    await throttleRequest();
    
    // First fetch the categories for football (sport ID 2)
    const categoriesUrl = `${API_BASE}/api/sportsbook/categories/${FOOTBALL_ID}`;
    const response = await makeRequest(categoriesUrl);
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('Invalid response format for categories API');
      return [];
    }
    
    // Get all competition IDs
    const competitions = [];
    for (const category of response.data) {
      if (category.competitions && Array.isArray(category.competitions)) {
        competitions.push(...category.competitions.map(comp => comp.id));
      }
    }
    
    console.log(`Found ${competitions.length} football competitions`);
    
    // Now fetch events for each competition
    const allEvents = [];
    for (const competitionId of competitions.slice(0, 5)) { // Limit to first 5 competitions to avoid rate limiting
      const events = await fetchCompetitionEvents(competitionId);
      if (events.length > 0) {
        allEvents.push(...events);
      }
    }
    
    return allEvents;
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    return [];
  }
}

/**
 * Fetch events for a specific competition ID
 */
async function fetchCompetitionEvents(competitionId) {
  try {
    await throttleRequest();
    
    const url = `${API_BASE}/api/sportsbook/competitions/${competitionId}`;
    const response = await makeRequest(url);
    
    if (!response.data || !response.data.events || !Array.isArray(response.data.events)) {
      return [];
    }
    
    // Filter to only include live events
    const liveEvents = response.data.events.filter(event => 
      event.status === 'LIVE' || event.status === 'INPLAY'
    );
    
    console.log(`Found ${liveEvents.length} live events in competition ${competitionId}`);
    
    // For each live event, fetch the detailed event data to get markets
    const detailedEvents = [];
    for (const event of liveEvents.slice(0, 10)) { // Limit to first 10 events per competition
      const detailedEvent = await fetchEventDetails(event.id);
      if (detailedEvent) {
        detailedEvents.push(detailedEvent);
      }
    }
    
    return detailedEvents;
  } catch (error) {
    console.error(`Error fetching events for competition ${competitionId}:`, error.message);
    return [];
  }
}

/**
 * Fetch detailed event information including markets
 */
async function fetchEventDetails(eventId) {
  try {
    await throttleRequest();
    
    const url = `${API_BASE}/api/sportsbook/events/${eventId}`;
    const response = await makeRequest(url);
    
    if (!response.data) {
      return null;
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching event details for event ${eventId}:`, error.message);
    return null;
  }
}

/**
 * Process the events data into a standardized format
 */
function processEvents(events, timestamp) {
  const processedEvents = [];
  
  for (const event of events) {
    if (!event) continue;
    
    // Get basic event info
    const eventId = event.id;
    
    // Extract event name
    let eventName = "Unknown Event";
    if (event.name) {
      eventName = event.name;
    } else if (event.competitors && event.competitors.length >= 2) {
      eventName = `${event.competitors[0].name} v ${event.competitors[1].name}`;
    } else if (event.homeTeam && event.awayTeam) {
      eventName = `${event.homeTeam} v ${event.awayTeam}`;
    }
    
    // Get country and competition info
    let country = "Unknown";
    let tournament = "Unknown";
    
    if (event.category && event.category.name) {
      country = event.category.name;
    }
    
    if (event.competition && event.competition.name) {
      tournament = event.competition.name;
    }
    
    // Find the 1X2 market
    let market1X2 = null;
    let market1X2Available = false;
    let homeOdds = null;
    let drawOdds = null;
    let awayOdds = null;
    
    if (event.markets && Array.isArray(event.markets)) {
      // Look for the 1X2 market (usually has typeId 3743)
      market1X2 = event.markets.find(market => 
        market.typeId === '3743' || 
        (market.type && market.type.id === '3743') || 
        (market.name && market.name.includes('1X2'))
      );
      
      if (market1X2) {
        // Check if market is suspended
        const isSuspended = market1X2.suspended === true || market1X2.status === 'SUSPENDED';
        
        if (!isSuspended && market1X2.outcomes && market1X2.outcomes.length >= 3) {
          // Sort outcomes to ensure we get home, draw, away in correct order
          const sortedOutcomes = [...market1X2.outcomes].sort((a, b) => {
            if (a.typeId && b.typeId) {
              return a.typeId.localeCompare(b.typeId);
            }
            return 0;
          });
          
          homeOdds = sortedOutcomes[0]?.decimal || sortedOutcomes[0]?.price;
          drawOdds = sortedOutcomes[1]?.decimal || sortedOutcomes[1]?.price;
          awayOdds = sortedOutcomes[2]?.decimal || sortedOutcomes[2]?.price;
          
          // Market is available if all odds are present
          market1X2Available = Boolean(homeOdds && drawOdds && awayOdds);
        }
      }
    }
    
    // Extract score data
    let score = null;
    if (event.score) {
      score = {
        home: event.score.home || 0,
        away: event.score.away || 0,
        period: event.score.period || ''
      };
    }
    
    // Create the standardized event object
    processedEvents.push({
      id: eventId,
      eventId: eventId,
      name: eventName,
      country: country,
      tournament: tournament,
      startTime: event.startTime || event.startDate,
      isLive: true,
      score: score,
      market1X2Available: market1X2Available,
      homeOdds: homeOdds,
      drawOdds: drawOdds,
      awayOdds: awayOdds,
      timestamp: timestamp
    });
  }
  
  return processedEvents;
}

/**
 * Make a request with proper headers
 */
async function makeRequest(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.betpawa.com.gh/',
    'Origin': 'https://www.betpawa.com.gh',
    'Connection': 'keep-alive',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  };
  
  return axios.get(url, {
    headers: headers,
    timeout: 15000 // 15 second timeout
  });
}

/**
 * Add a delay between requests to avoid rate limiting
 */
async function throttleRequest() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < REQUEST_DELAY) {
    const delay = REQUEST_DELAY - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  lastRequestTime = Date.now();
}

module.exports = {
  scrapeLiveEvents: getLiveMatches
};