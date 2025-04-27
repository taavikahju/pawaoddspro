/**
 * Dedicated scraper for BetPawa Ghana - CommonJS version for 15-minute scraping
 * CJS extension explicitly marks this as CommonJS format
 */

const axios = require('axios');

// Create logger that only logs to stderr when called programmatically
const logger = {
  log: function(...args) {
    if (require.main === module) {
      console.error(...args); // Use console.error to avoid polluting stdout
    }
  },
  error: function(...args) {
    if (require.main === module) {
      console.error(...args);
    }
  }
};

/**
 * Main function to scrape BetPawa Ghana upcoming events
 */
async function scrapeBetPawaGhana() {
  logger.log('Starting BetPawa Ghana 15-minute scraper (CommonJS version)');
  
  // Define constants
  const DOMAIN = 'www.betpawa.com.gh';
  const BRAND = 'ghana';
  
  // Generate a unique cache-busting timestamp
  const cacheBuster = Date.now();
  
  // Create headers - Important changes to fix 304 Not Modified responses:
  // 1. Remove the if-modified-since header
  // 2. Add cache control headers to prevent caching
  // 3. Add a random timestamp parameter to ensure fresh content
  const headers = {
    "accept": "*/*",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "baggage": "sentry-environment=production,sentry-release=1.203.58",
    "devicetype": "web",
    "cache-control": "no-cache, no-store",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "referer": `https://${DOMAIN}/events?marketId=1X2&categoryId=2&_t=${cacheBuster}`,
    "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sentry-trace": `${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}-0`,
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "vuejs": "true",
    "x-pawa-brand": `betpawa-${BRAND}`,
    "x-pawa-language": "en"
  };
  
  // Generate a new session ID for each request to avoid caching
  const sessionId = Math.random().toString(36).substring(2);
  
  // Use updated cookies with timestamp to prevent caching
  const cookies = {
    "_ga": `GA1.1.${Math.floor(Math.random() * 1000000000)}.${Date.now()}`,
    "_ga_608WPEPCC3": `GS1.1.${Date.now()}.${Math.floor(Math.random() * 10)}.0.${Date.now()}.0.0.0`,
    "aff_cookie": "F60",
    "_gcl_au": `1.1.${Math.floor(Math.random() * 1000000000)}.${Date.now()}`,
    "PHPSESSID": sessionId,
    "tracingId": `${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}`,
    "x-pawa-token": `${Math.random().toString(36).substring(2)}-${Math.random().toString(36).substring(2)}`
  };
  
  // Convert cookies to string format for axios
  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
  
  // Add cookies to headers
  const headerWithCookies = {
    ...headers,
    cookie: cookieString
  };
  
  try {
    // Parameters
    const allEvents = [];
    const take = 20;
    let skip = 0;
    let totalPages = 0;
    
    // We need to scrape UPCOMING matches for the 15-minute scraper (not live ones)
    while (totalPages < 50) { // Increased from 15 to 50 pages to collect all events
      logger.log(`Fetching upcoming events with skip=${skip}`);
      
      // Build query parameter - specifically for UPCOMING events with football (category 2)
      const encodedQuery = `%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22UPCOMING%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A${skip}%2C%22take%22%3A${take}%7D%5D%7D`;
      
      // Build URL
      const url = `https://${DOMAIN}/api/sportsbook/v2/events/lists/by-queries?q=${encodedQuery}`;
      
      try {
        // Make request with timeout - shorter timeout to avoid hanging
        logger.log(`Making request to ${url}`);
        const response = await axios.get(url, {
          headers: headerWithCookies,
          timeout: 15000 // 15 seconds timeout
        });
        
        // Check for valid response
        if (response.status !== 200) {
          logger.log(`Request failed with status ${response.status}`);
          break;
        }
        
        // Parse events from response
        let events = [];
        
        // Different APIs might return data in different structures, handle all possibilities
        if (response.data?.queries?.[0]?.events) {
          events = response.data.queries[0].events;
          logger.log('Found events in queries[0].events');
        } else if (response.data?.responses?.[0]?.responses) {
          events = response.data.responses[0].responses;
          logger.log('Found events in responses[0].responses');
        } else if (response.data?.events) {
          events = response.data.events;
          logger.log('Found events in events');
        }
        
        // If no events found, break the loop
        if (!events || events.length === 0) {
          logger.log('No more events found');
          break;
        }
        
        logger.log(`Found ${events.length} events on this page`);
        
        // Process events
        for (const event of events) {
          try {
            // Get widget ID for SportRadar
            const widget = event.widgets?.find(w => w.type === 'SPORTRADAR');
            const widgetId = widget?.id || '';
            
            // Find the 1X2 market
            const market = event.markets?.find(m => m.marketType?.id === '3743');
            const marketPrices = market?.prices || [];
            
            // Extract home, draw and away odds
            const homeOdds = marketPrices.find(p => p.name === '1')?.price || '';
            const drawOdds = marketPrices.find(p => p.name === 'X')?.price || '';
            const awayOdds = marketPrices.find(p => p.name === '2')?.price || '';
            
            // Extract names for home and away teams
            let homeTeam = '';
            let awayTeam = '';
            
            if (event.name && event.name.includes(' vs ')) {
              const parts = event.name.split(' vs ');
              homeTeam = parts[0];
              awayTeam = parts[1];
            } else if (event.competitors && event.competitors.length >= 2) {
              homeTeam = event.competitors[0].name;
              awayTeam = event.competitors[1].name;
            }
            
            // Create event object with all data needed for the heartbeat
            const eventObject = {
              id: event.id,
              eventId: widgetId || event.id || '',
              country: event.region?.name || event.category?.name || 'Unknown',
              tournament: event.competition?.name || event.league?.name || 'Unknown',
              event: event.name || `${homeTeam} vs ${awayTeam}`,
              name: event.name || `${homeTeam} vs ${awayTeam}`,
              home_odds: homeOdds,
              draw_odds: drawOdds,
              away_odds: awayOdds,
              start_time: event.startTime || '',
              gameMinute: event.scoreboard?.display?.minute || '',
              sport: 'football',
              competitors: event.competitors || [
                { name: homeTeam },
                { name: awayTeam }
              ],
              markets: [
                {
                  marketType: { id: "3743", name: "1X2" },
                  suspended: !homeOdds || !drawOdds || !awayOdds || market?.suspended,
                  prices: [
                    { name: "1", price: homeOdds },
                    { name: "X", price: drawOdds },
                    { name: "2", price: awayOdds }
                  ]
                }
              ],
              category: { name: event.region?.name || event.category?.name || 'Unknown' },
              region: { name: event.region?.name || event.category?.name || 'Unknown' },
              competition: { name: event.competition?.name || event.league?.name || 'Unknown' },
              league: { name: event.competition?.name || event.league?.name || 'Unknown' },
              isInPlay: false,
              status: 'UPCOMING',
              scoreboard: {
                display: {
                  minute: event.scoreboard?.display?.minute || ''
                }
              }
            };
            
            allEvents.push(eventObject);
          } catch (eventError) {
            logger.error(`Error processing event: ${eventError.message}`);
          }
        }
        
        // Check if we need to paginate
        if (events.length < take) {
          logger.log('Received fewer events than requested, done paginating');
          break;
        }
        
        // Move to next page
        skip += take;
        totalPages++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (pageError) {
        logger.error(`Error fetching page with skip=${skip}: ${pageError.message}`);
        break;
      }
    }
    
    logger.log(`Total upcoming events scraped: ${allEvents.length} from ${totalPages} pages`);
    
    // If running directly, print detailed stats
    if (require.main === module) {
      console.error(`BETPAWA GHANA STATS: Found ${allEvents.length} events across ${totalPages} pages`);
    }
    
    return allEvents;
  } catch (error) {
    logger.error(`Error in BetPawa Ghana scraper: ${error.message}`);
    return [];
  }
}

// For direct execution
if (require.main === module) {
  scrapeBetPawaGhana().then(events => {
    console.error(`BETPAWA GHANA SCRAPER STATS: Found ${events.length} events`);
    
    // Output events in chunks to avoid EPIPE errors with large datasets
    if (events.length > 0) {
      // First output summary to stderr (which doesn't get piped to the parent process)
      console.error(`BETPAWA GHANA STATS: Total upcoming events scraped: ${events.length}`);
      
      // Then output the data in smaller chunks to stdout
      const CHUNK_SIZE = 100;
      const output = JSON.stringify(events);
      
      // Using process.stdout.write instead of console.log to avoid additional newlines
      for (let i = 0; i < output.length; i += CHUNK_SIZE) {
        process.stdout.write(output.substring(i, i + CHUNK_SIZE));
      }
    } else {
      // If no events, just output an empty array
      console.log("[]");
    }
  }).catch(err => {
    console.error(`BETPAWA GHANA SCRAPER ERROR: ${err.message}`);
    // Output empty array on error so parent process can continue
    console.log("[]");
  });
} else {
  // When called as a module, don't output anything to console
}

module.exports = scrapeBetPawaGhana;