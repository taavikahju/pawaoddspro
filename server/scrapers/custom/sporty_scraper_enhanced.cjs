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
    const baseUrl = `https://www.sportybet.com`;
    
    // The API endpoint varies by region
    // Try a few different URL patterns to increase our chances of success
    const apiEndpoints = [
      `/api/${region}/facets/sport/preMatch`,  // Try with region code
      `/api/ng/facets/sport/preMatch`,        // Default to Nigeria
      `/api/facets/sport/preMatch`            // Try without region
    ];
    
    let response = null;
    let successfulEndpoint = null;
    
    // Try each endpoint until we get a valid response
    for (const endpoint of apiEndpoints) {
      const apiUrl = `${baseUrl}${endpoint}`;
      console.error(`Trying SportyBet API endpoint: ${apiUrl}`);
      
      try {
        const result = await fetchData(apiUrl);
        if (result && result.data && result.data.tournaments) {
          response = result;
          successfulEndpoint = apiUrl;
          console.error(`✅ Success with endpoint: ${apiUrl}`);
          break;
        }
      } catch (endpointError) {
        console.error(`Failed with endpoint ${endpoint}: ${endpointError.message}`);
      }
    }
    
    if (!response) {
      console.error(`All API endpoints failed for ${region}`);
      
      // Try a fallback to the static data URL
      const fallbackUrl = `${baseUrl}/${region}/sport/football/upcoming`;
      console.error(`Trying fallback URL: ${fallbackUrl}`);
      
      try {
        // This is just to check if the site is accessible, we don't use the result directly
        await fetchData(fallbackUrl);
        console.error(`Site is accessible at ${fallbackUrl} but API failed. Possible API format change.`);
      } catch (fallbackError) {
        console.error(`Fallback URL also failed for ${region}: ${fallbackError.message}`);
      }
      
      return [];
    }
    
    console.error(`Processing data from ${successfulEndpoint}`);
    
    // Extract all events
    const allEvents = [];
    
    // Log the tournament data structure to help with debugging
    if (response.data.tournaments && response.data.tournaments.length > 0) {
      const firstTournament = response.data.tournaments[0];
      console.error(`Tournament data structure example:`);
      console.error(`- Sport: ${firstTournament.sport}`);
      console.error(`- Country: ${firstTournament.country}`);
      
      if (firstTournament.tournaments && firstTournament.tournaments.length > 0) {
        console.error(`- Tournament name: ${firstTournament.tournaments[0].name}`);
        
        if (firstTournament.tournaments[0].events && firstTournament.tournaments[0].events.length > 0) {
          const firstEvent = firstTournament.tournaments[0].events[0];
          console.error(`- Event ID: ${firstEvent.id}`);
          console.error(`- Has participants: ${!!firstEvent.participants}`);
          console.error(`- Has markets: ${!!firstEvent.markets}`);
        }
      }
    }
    
    // Process tournaments to get all events
    for (const tournamentGroup of response.data.tournaments) {
      // Skip non-football tournaments
      if (tournamentGroup.sport !== 'football') continue;
      
      const countryName = tournamentGroup.country || 'International';
      
      for (const tournament of tournamentGroup.tournaments) {
        const tournamentName = tournament.name || 'Unknown';
        
        for (const event of tournament.events) {
          try {
            // Skip if no participants data
            if (!event.participants || event.participants.length < 2) {
              console.error(`Invalid participants data for event ${event.id}`);
              continue;
            }
            
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
            
            // Default odds (in case we can't find them)
            eventObj.home_odds = 0;
            eventObj.draw_odds = 0;
            eventObj.away_odds = 0;
            eventObj['1'] = 0;
            eventObj['X'] = 0;
            eventObj['2'] = 0;
            
            // Extract odds if available
            if (event.markets && event.markets.length > 0) {
              // Find the 1X2 market
              const market1X2 = event.markets.find(m => m.name === '1X2');
              
              if (market1X2 && market1X2.selections && market1X2.selections.length === 3) {
                eventObj.home_odds = parseFloat(market1X2.selections[0].odds) || 0;
                eventObj.draw_odds = parseFloat(market1X2.selections[1].odds) || 0;
                eventObj.away_odds = parseFloat(market1X2.selections[2].odds) || 0;
                
                // Also add in numeric format for compatibility
                eventObj['1'] = eventObj.home_odds;
                eventObj['X'] = eventObj.draw_odds;
                eventObj['2'] = eventObj.away_odds;
              }
            }
            
            // Only add if we have valid odds
            if (eventObj.home_odds > 0 && eventObj.draw_odds > 0 && eventObj.away_odds > 0) {
              allEvents.push(eventObj);
            } else {
              console.error(`Skipping event ${eventObj.id} (${eventObj.event}) due to invalid odds`);
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
    console.error(`Error stack:`, error.stack);
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