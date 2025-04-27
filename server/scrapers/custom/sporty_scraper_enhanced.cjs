#!/usr/bin/env node

/**
 * Enhanced SportyBet Scraper
 * 
 * This scraper supports multiple regions:
 * - Ghana
 * - Kenya
 * - Nigeria  
 * - Tanzania
 * - Uganda
 * - South Africa
 * 
 * It extracts more data than the basic scraper, including:
 * - More accurate team names
 * - Better league/tournament information
 * - More reliable odds data
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

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
    https.get(url, (res) => {
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

// Get all football events from a specific region
async function getSportyBetEvents(region) {
  try {
    // SportyBet API URL for football events by region
    const url = `https://www.sportybet.com/${region}/sport/football?tab=upcoming`;
    
    // The API endpoint that lists all available events
    const apiUrl = `https://www.sportybet.com/api/ng/facets/sport/preMatch`;
    
    // Make the request
    const response = await fetchData(apiUrl);
    
    if (!response || !response.data || !response.data.tournaments) {
      console.error(`No tournaments found for ${region}`);
      return [];
    }
    
    // Extract all events
    const allEvents = [];
    
    // Process tournaments to get all events
    for (const tournamentGroup of response.data.tournaments) {
      // Skip non-football tournaments
      if (tournamentGroup.sport !== 'football') continue;
      
      const countryName = tournamentGroup.country || 'International';
      
      for (const tournament of tournamentGroup.tournaments) {
        const tournamentName = tournament.name || 'Unknown';
        
        for (const event of tournament.events) {
          try {
            // Extract home and away team names
            const homeTeamName = event.participants[0].name || '';
            const awayTeamName = event.participants[1].name || '';
            
            // Create event object
            const eventObj = {
              id: event.id,
              event: `${homeTeamName} vs ${awayTeamName}`,
              homeTeamName,
              awayTeamName,
              country: countryName,
              tournament: tournamentName,
              league: `${countryName} ${tournamentName}`,
              start_time: event.startTime,
              date: new Date(event.startTime).toISOString().split('T')[0],
              time: new Date(event.startTime).toISOString().split('T')[1].substring(0, 5),
              bookmakerCode: 'sporty',
              region
            };
            
            // Extract odds if available
            if (event.markets && event.markets.length > 0) {
              // Find the 1X2 market
              const market1X2 = event.markets.find(m => m.name === '1X2');
              
              if (market1X2 && market1X2.selections && market1X2.selections.length === 3) {
                eventObj.home_odds = market1X2.selections[0].odds;
                eventObj.draw_odds = market1X2.selections[1].odds;
                eventObj.away_odds = market1X2.selections[2].odds;
                
                // Also add in numeric format for compatibility
                eventObj['1'] = market1X2.selections[0].odds;
                eventObj['X'] = market1X2.selections[1].odds;
                eventObj['2'] = market1X2.selections[2].odds;
                
                // Add to the list
                allEvents.push(eventObj);
              }
            }
          } catch (err) {
            console.error(`Error processing event ${event.id}:`, err.message);
          }
        }
      }
    }
    
    return allEvents;
  } catch (error) {
    console.error(`Error fetching SportyBet events for ${region}:`, error.message);
    return [];
  }
}

// Main function to scrape SportyBet across all regions
async function scrapeSportyBet() {
  try {
    console.error('Starting enhanced SportyBet scraper...');
    
    const allEvents = [];
    
    // Process each region in parallel
    const promises = REGIONS.map(region => getSportyBetEvents(region.code));
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const events = result.value;
        console.error(`- Fetched ${events.length} events from ${REGIONS[index].name} (${REGIONS[index].code})`);
        allEvents.push(...events);
      } else {
        console.error(`- Failed to fetch data from ${REGIONS[index].name} (${REGIONS[index].code}): ${result.reason}`);
      }
    });
    
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
    const events = await scrapeSportyBet();
    console.log(JSON.stringify(events));
  } catch (error) {
    console.error('Fatal error in SportyBet scraper:', error);
    console.log('[]');
  }
}

// Run the scraper
main();