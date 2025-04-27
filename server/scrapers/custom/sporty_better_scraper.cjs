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
const BASE_URL = 'https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents';
const QUERY = 'sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100&option=1';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept': 'application/json'
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

// Fetch data from SportyBet API
async function fetchData(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: HEADERS
    };
    
    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Fetch all pages from the API
async function fetchAllPages(region) {
  try {
    const baseUrl = BASE_URL.replace('/gh/', `/${region}/`);
    let currentPage = 1;
    let hasMorePages = true;
    let allEvents = [];
    
    while (hasMorePages) {
      const pageUrl = `${baseUrl}?${QUERY}&pageNo=${currentPage}`;
      console.error(`Fetching SportyBet ${region} page ${currentPage}...`);
      
      const response = await fetchData(pageUrl);
      
      if (response && response.data && response.data.events) {
        const events = response.data.events;
        console.error(`Found ${events.length} events on page ${currentPage}`);
        allEvents = allEvents.concat(events);
        
        // Check if there are more pages
        hasMorePages = events.length > 0 && events.length >= 100; // Assuming 100 is the page size
        currentPage++;
      } else {
        console.error(`No events found on page ${currentPage} or invalid response`);
        hasMorePages = false;
      }
      
      // Safety check - don't fetch more than 5 pages to avoid infinite loops
      if (currentPage > 5) {
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
      // Extract the match details
      const id = event.id || '';
      const teams = event.name || '';
      const competition = event.competition || {};
      const league = competition.name || 'Unknown League';
      const startTime = event.startTime || '';
      
      // Extract the 1X2 market odds
      let homeOdds = 0;
      let drawOdds = 0;
      let awayOdds = 0;
      
      if (event.markets && event.markets.length > 0) {
        // Find the 1X2 market
        const market1X2 = event.markets.find(m => m.name === '1X2' || m.marketType === '1X2');
        
        if (market1X2 && market1X2.selections && market1X2.selections.length === 3) {
          homeOdds = parseFloat(market1X2.selections[0].odds) || 0;
          drawOdds = parseFloat(market1X2.selections[1].odds) || 0;
          awayOdds = parseFloat(market1X2.selections[2].odds) || 0;
        }
      }
      
      // Format the date and time
      let date = '';
      let time = '';
      if (startTime) {
        const startTimeDate = new Date(startTime);
        date = startTimeDate.toISOString().split('T')[0];
        time = startTimeDate.toISOString().split('T')[1].substring(0, 5);
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
  }).filter(event => event && event.odds.home > 0 && event.odds.draw > 0 && event.odds.away > 0);
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