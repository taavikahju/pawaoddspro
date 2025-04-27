#!/usr/bin/env node

/**
 * Enhanced SportyBet Scraper using a more reliable API endpoint
 * 
 * This scraper uses the factsCenter/pcUpcomingEvents endpoint which is more
 * stable and provides better formatted data than the previous endpoints.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Base URL and query parameters for the SportyBet API
// Try a different approach - use the event lists endpoint directly
const BASE_URL = 'https://www.sportybet.com/api/gh/sport/football/eventlists';
const QUERY = 'inplay=false&markets=1&take=100&skip=0';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.sportybet.com',
  'Referer': 'https://www.sportybet.com/gh/sport/football/upcoming'
};

// Countries supported by SportyBet
const REGIONS = [
  { code: 'gh', name: 'Ghana' },
  { code: 'ke', name: 'Kenya' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'tz', name: 'Tanzania' },
  { code: 'ug', name: 'Uganda' },
  { code: 'za', name: 'South Africa' }
];

// Fetch data from SportyBet API with improved error handling
async function fetchData(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: HEADERS
    };
    
    console.error(`Making request to: ${url}`);
    console.error(`With headers: ${JSON.stringify(HEADERS)}`);
    
    const req = https.get(url, options, (res) => {
      let data = '';
      
      // Log response status and headers for debugging
      console.error(`Response status: ${res.statusCode} ${res.statusMessage}`);
      console.error(`Response headers: ${JSON.stringify(res.headers)}`);
      
      // Check for redirects or non-success status codes
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.error(`Redirect detected to: ${res.headers.location}`);
        // Could follow redirects here, but for now just log them
      }
      
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP error: ${res.statusCode} ${res.statusMessage}`));
      }
      
      // Check content type to ensure we're getting JSON
      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('application/json')) {
        console.error(`Warning: Content-Type is not JSON: ${contentType}`);
      }
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // First check if we got HTML instead of JSON
          if (data.trim().startsWith('<!DOCTYPE html>') || data.trim().startsWith('<html>')) {
            console.error('Received HTML response instead of JSON');
            const sample = data.substring(0, 200).replace(/\n/g, '').replace(/\s+/g, ' ');
            console.error(`HTML sample: ${sample}...`);
            return reject(new Error('Received HTML response instead of JSON'));
          }
          
          // Log the first 200 chars of response for debugging
          if (data.length > 0) {
            console.error(`Response data sample: ${data.substring(0, 200)}...`);
          }
          
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          console.error(`Error parsing JSON: ${error.message}`);
          if (data.length > 0) {
            const sample = data.substring(0, 500);
            console.error(`Response sample causing parse error: ${sample}`);
          }
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Request error: ${error.message}`);
      reject(error);
    });
    
    // Add timeout to avoid hanging requests
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout after 30 seconds'));
    });
  });
}

// Fetch all pages from the API
async function fetchAllPages(region) {
  try {
    const baseUrl = BASE_URL.replace('/gh/', `/${region}/`);
    let currentSkip = 0;
    const pageSize = 100;
    let hasMorePages = true;
    let allEvents = [];
    let pageNumber = 1;
    
    while (hasMorePages) {
      // Build the URL with proper skip parameter for pagination
      const pageUrl = `${baseUrl}?${QUERY.replace('skip=0', `skip=${currentSkip}`)}`;
      console.error(`Fetching SportyBet ${region} page ${pageNumber} (skip=${currentSkip})...`);
      
      const response = await fetchData(pageUrl);
      
      // Check for different response formats
      let events = [];
      if (response && response.data && Array.isArray(response.data.events)) {
        // Format from factsCenter endpoint
        events = response.data.events;
      } else if (response && Array.isArray(response.data)) {
        // Format from eventlists endpoint
        events = response.data;
      } else if (response && response.events && Array.isArray(response.events)) {
        // Another possible format
        events = response.events;
      } else {
        // Log the entire response for debugging
        console.error('Unknown response format:', JSON.stringify(response).substring(0, 300) + '...');
        events = [];
      }
      
      if (events.length > 0) {
        console.error(`Found ${events.length} events on page ${pageNumber}`);
        allEvents = allEvents.concat(events);
        
        // Move to next page
        currentSkip += pageSize;
        pageNumber++;
        
        // Check if there are more pages
        hasMorePages = events.length >= pageSize; // Assuming pageSize is the page size
      } else {
        console.error(`No events found on page ${pageNumber} or invalid response`);
        hasMorePages = false;
      }
      
      // Safety check - don't fetch more than 5 pages to avoid infinite loops
      if (pageNumber > 5) {
        console.error('Reached maximum page limit (5). Stopping pagination.');
        hasMorePages = false;
      }
    }
    
    return allEvents;
  } catch (error) {
    console.error(`Error fetching all pages for ${region}:`, error.message);
    return [];
  }
}

// Process the events from the API response
function processEvents(events, region) {
  return events.map(event => {
    try {
      console.error('Processing event:', JSON.stringify(event).substring(0, 300));
      
      // Extract the match details - handle different formats
      const id = event.id || event.eventId || event.externalId || '';
      
      // Handle different event name formats
      let teams = '';
      if (event.name) {
        teams = event.name;
      } else if (event.names && event.names.length > 0) {
        teams = event.names[0];
      } else if (event.homeTeam && event.awayTeam) {
        teams = `${event.homeTeam} - ${event.awayTeam}`;
      } else if (event.teams && event.teams.length >= 2) {
        teams = `${event.teams[0]} - ${event.teams[1]}`;
      } else {
        teams = 'Unknown Teams';
      }
      
      // Handle different league formats
      let league = 'Unknown League';
      if (event.competition && event.competition.name) {
        league = event.competition.name;
      } else if (event.tournament) {
        league = event.tournament;
      } else if (event.league) {
        league = event.league;
      } else if (event.competition) {
        league = event.competition;
      }
      
      // Handle different time formats
      let startTime = '';
      if (event.startTime) {
        startTime = event.startTime;
      } else if (event.eventTime) {
        startTime = event.eventTime;
      } else if (event.date && event.time) {
        startTime = `${event.date}T${event.time}`;
      }
      
      // Extract the 1X2 market odds - handle different formats
      let homeOdds = 0;
      let drawOdds = 0;
      let awayOdds = 0;
      
      // First attempt: markets array with selections
      if (event.markets && event.markets.length > 0) {
        // Find the 1X2 market
        const market1X2 = event.markets.find(m => 
          m.name === '1X2' || m.marketType === '1X2' || m.id === '1');
        
        if (market1X2 && market1X2.selections && market1X2.selections.length === 3) {
          homeOdds = parseFloat(market1X2.selections[0].odds || market1X2.selections[0].price) || 0;
          drawOdds = parseFloat(market1X2.selections[1].odds || market1X2.selections[1].price) || 0;
          awayOdds = parseFloat(market1X2.selections[2].odds || market1X2.selections[2].price) || 0;
        }
      }
      
      // Second attempt: direct odds properties
      if (homeOdds === 0 && event.odds) {
        homeOdds = parseFloat(event.odds.home || event.odds[1] || event.odds['1']) || 0;
        drawOdds = parseFloat(event.odds.draw || event.odds.x || event.odds['X']) || 0;
        awayOdds = parseFloat(event.odds.away || event.odds[2] || event.odds['2']) || 0;
      }
      
      // Third attempt: direct properties
      if (homeOdds === 0) {
        homeOdds = parseFloat(event.homeOdds || event.homePrice || event['1'] || event.home_odds) || 0;
        drawOdds = parseFloat(event.drawOdds || event.drawPrice || event.X || event.draw_odds) || 0;
        awayOdds = parseFloat(event.awayOdds || event.awayPrice || event['2'] || event.away_odds) || 0;
      }
      
      // Format the date and time
      let date = '';
      let time = '';
      if (startTime) {
        try {
          const startTimeDate = new Date(startTime);
          date = startTimeDate.toISOString().split('T')[0];
          time = startTimeDate.toISOString().split('T')[1].substring(0, 5);
        } catch (error) {
          console.error('Error parsing date:', error);
          // Fallback to current date if parsing fails
          const now = new Date();
          date = now.toISOString().split('T')[0];
          time = now.toISOString().split('T')[1].substring(0, 5);
        }
      }
      
      // Create the event object
      return {
        id,
        teams,
        league,
        sport: 'football',
        date,
        time,
        bookmakerCode: 'sporty',
        region,
        odds: {
          home: homeOdds,
          draw: drawOdds,
          away: awayOdds
        }
      };
    } catch (error) {
      console.error(`Error processing event:`, error.message);
      return null;
    }
  }).filter(event => {
    // Filter out events with no valid odds
    if (!event) return false;
    
    const hasValidOdds = event.odds.home > 0 && event.odds.draw > 0 && event.odds.away > 0;
    if (!hasValidOdds) {
      console.error(`Skipping event ${event.id} (${event.teams}) - missing valid odds:`, event.odds);
    }
    
    return hasValidOdds;
  });
}

// Main function to scrape SportyBet across all regions
async function scrapeAllRegions() {
  try {
    console.error('Starting SportyBet scraper with new API endpoint...');
    
    const allEvents = [];
    
    // Process each region in sequence
    for (const region of REGIONS) {
      try {
        console.error(`Fetching events for ${region.name} (${region.code})...`);
        const events = await fetchAllPages(region.code);
        
        if (events.length > 0) {
          const processedEvents = processEvents(events, region.code);
          console.error(`Successfully processed ${processedEvents.length} events from ${region.name} (${region.code})`);
          allEvents.push(...processedEvents);
        } else {
          console.error(`No events found for ${region.name} (${region.code})`);
        }
      } catch (error) {
        console.error(`Error processing ${region.name} (${region.code}):`, error.message);
      }
    }
    
    console.error(`Total events collected: ${allEvents.length}`);
    
    return allEvents;
  } catch (error) {
    console.error('Error in SportyBet scraper:', error);
    return [];
  }
}

// Run the scraper and output JSON to stdout
async function main() {
  try {
    const events = await scrapeAllRegions();
    console.log(JSON.stringify(events));
  } catch (error) {
    console.error('Fatal error in SportyBet scraper:', error);
    console.log('[]');
  }
}

// Run the scraper
main();