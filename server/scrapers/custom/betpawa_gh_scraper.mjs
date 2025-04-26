/**
 * Dedicated scraper for BetPawa Ghana - designed for live events tracking
 * This is a JavaScript ES modules version that avoids using crypto.randomBytes
 */

import axios from 'axios';

/**
 * Main function to scrape BetPawa Ghana live events
 */
export async function scrapeBetPawaGhana() {
  console.log('Starting BetPawa Ghana live scraper (ES modules version)');
  
  // Define constants
  const DOMAIN = 'www.betpawa.com.gh';
  const BRAND = 'ghana';
  
  // Create headers
  const headers = {
    "accept": "*/*",
    "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
    "baggage": "sentry-environment=production,sentry-release=1.203.58",
    "devicetype": "web",
    "if-modified-since": new Date().toUTCString(),
    "priority": "u=1, i",
    "referer": `https://${DOMAIN}/events?marketId=1X2&categoryId=2`,
    "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sentry-trace": "69dc4eced394402e8b4842078bf03b47-982bacd1c87283b4-0",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "vuejs": "true",
    "x-pawa-brand": `betpawa-${BRAND}`,
    "x-pawa-language": "en"
  };
  
  // Use fixed cookies instead of random ones to avoid crypto dependency problems
  const cookies = {
    "_ga": "GA1.1.459857438.1713161475",
    "_ga_608WPEPCC3": "GS1.1.1731480684.7.0.1731480684.0.0.0",
    "aff_cookie": "F60",
    "_gcl_au": "1.1.1725251410.1738666716",
    "PHPSESSID": "b0694dabe05179bc223abcdf8f7bf83e",
    "tracingId": "0f5927de-e30d-4228-b29c-c92210017a62",
    "x-pawa-token": "b4c6eda2ae319f4b-8a3075ba3c9d9984"
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
    
    while (true) {
      console.log(`Fetching live events with skip=${skip}`);
      
      // Build query parameter - specifically for LIVE events with football (category 2)
      const encodedQuery = `%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A${skip}%2C%22take%22%3A${take}%7D%5D%7D`;
      
      // Build URL
      const url = `https://${DOMAIN}/api/sportsbook/v2/events/lists/by-queries?q=${encodedQuery}`;
      
      try {
        // Make request
        const response = await axios.get(url, {
          headers: headerWithCookies,
          timeout: 20000
        });
        
        // Check for valid response
        if (response.status !== 200) {
          console.log(`Request failed with status ${response.status}`);
          break;
        }
        
        // Parse events from response
        let events = [];
        
        // Log the response structure for debugging
        console.log('Response data keys:', Object.keys(response.data));
        if (response.data?.responses) {
          console.log('responses array length:', response.data.responses.length);
          if (response.data.responses[0]) {
            console.log('First response keys:', Object.keys(response.data.responses[0]));
            
            // If this is a responses format, log a sample response to understand structure
            if (response.data.responses[0].responses && response.data.responses[0].responses.length > 0) {
              const sampleEvent = response.data.responses[0].responses[0];
              console.log('Sample event keys:', Object.keys(sampleEvent));
              console.log('Sample event name:', sampleEvent.name);
              if (sampleEvent.competitors) {
                console.log('Sample event has competitors:', sampleEvent.competitors.length);
                if (sampleEvent.competitors.length > 0) {
                  console.log('First competitor:', sampleEvent.competitors[0].name);
                }
              }
            }
          }
        }
        
        // Different APIs might return data in different structures, handle all possibilities
        if (response.data?.queries?.[0]?.events) {
          events = response.data.queries[0].events;
          console.log('Found events in queries[0].events');
        } else if (response.data?.responses?.[0]?.responses) {
          events = response.data.responses[0].responses;
          console.log('Found events in responses[0].responses');
        } else if (response.data?.events) {
          events = response.data.events;
          console.log('Found events in events');
        }
        
        // If no events found, break the loop
        if (!events || events.length === 0) {
          console.log('No more events found');
          break;
        }
        
        console.log(`Found ${events.length} events on this page`);
        
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
              event: homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : (event.name || 'Unknown Event'),
              name: homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : (event.name || 'Unknown Event'),
              home_team: homeTeam,
              away_team: awayTeam,
              home_odds: homeOdds,
              draw_odds: drawOdds,
              away_odds: awayOdds,
              start_time: event.startTime || '',
              gameMinute: event.scoreboard?.display?.minute || '',
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
              isInPlay: true,
              status: 'LIVE',
              scoreboard: {
                display: {
                  minute: event.scoreboard?.display?.minute || ''
                }
              }
            };
            
            allEvents.push(eventObject);
          } catch (eventError) {
            console.error(`Error processing event: ${eventError.message}`);
          }
        }
        
        // Check if we need to paginate
        if (events.length < take) {
          console.log('Received fewer events than requested, done paginating');
          break;
        }
        
        // Move to next page
        skip += take;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (pageError) {
        console.error(`Error fetching page with skip=${skip}: ${pageError.message}`);
        break;
      }
    }
    
    console.log(`Total live events scraped: ${allEvents.length}`);
    return allEvents;
  } catch (error) {
    console.error(`Error in BetPawa Ghana scraper: ${error.message}`);
    return [];
  }
}

// Domain-specific scraper function
export async function scrapeWithDomain(domain, brand) {
  try {
    console.log(`Trying BetPawa ${brand} domain (${domain})...`);
    
    // Parameters
    const allEvents = [];
    const take = 20;
    let skip = 0;
    
    // Create headers
    const headers = {
      "accept": "*/*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      "baggage": "sentry-environment=production,sentry-release=1.203.58",
      "devicetype": "web",
      "if-modified-since": new Date().toUTCString(),
      "priority": "u=1, i",
      "referer": `https://${domain}/events?marketId=1X2&categoryId=2`,
      "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sentry-trace": "69dc4eced394402e8b4842078bf03b47-982bacd1c87283b4-0",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "vuejs": "true",
      "x-pawa-brand": `betpawa-${brand}`,
      "x-pawa-language": "en"
    };
    
    // Use fixed cookies
    const cookies = {
      "_ga": "GA1.1.459857438.1713161475",
      "_ga_608WPEPCC3": "GS1.1.1731480684.7.0.1731480684.0.0.0",
      "aff_cookie": "F60",
      "_gcl_au": "1.1.1725251410.1738666716",
      "PHPSESSID": "b0694dabe05179bc223abcdf8f7bf83e",
      "tracingId": "0f5927de-e30d-4228-b29c-c92210017a62",
      "x-pawa-token": "b4c6eda2ae319f4b-8a3075ba3c9d9984"
    };
    
    // Convert cookies to string
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    
    headers['cookie'] = cookieString;
    
    while (true) {
      // Build query parameter
      const encodedQuery = `%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A${skip}%2C%22take%22%3A${take}%7D%5D%7D`;
      
      // Build URL
      const url = `https://${domain}/api/sportsbook/v2/events/lists/by-queries?q=${encodedQuery}`;
      
      console.log(`Trying: ${url}`);
      
      try {
        // Make request
        const response = await axios.get(url, {
          headers,
          timeout: 20000
        });
        
        // Check for valid response
        if (response.status !== 200) {
          console.log(`Request failed with status ${response.status}`);
          break;
        }
        
        // Parse events from response
        let events = [];
        
        if (response.data?.queries?.[0]?.events) {
          events = response.data.queries[0].events;
        } else if (response.data?.responses?.[0]?.responses) {
          events = response.data.responses[0].responses;
        } else if (response.data?.events) {
          events = response.data.events;
        }
        
        if (!events || events.length === 0) {
          console.log('No more events found');
          break;
        }
        
        console.log(`Found ${events.length} events on page with skip=${skip}`);
        
        // Process events
        for (const event of events) {
          try {
            // Get widget ID for SportRadar
            const widget = event.widgets?.find(w => w.type === 'SPORTRADAR');
            const widgetId = widget?.id || '';
            
            // Find the 1X2 market
            const market = event.markets?.find(m => m.marketType?.id === '3743');
            const marketPrices = market?.prices || [];
            
            // Extract odds
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
            
            // Create event object
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
              isInPlay: true,
              status: 'LIVE',
              scoreboard: {
                display: {
                  minute: event.scoreboard?.display?.minute || ''
                }
              }
            };
            
            allEvents.push(eventObject);
          } catch (eventError) {
            console.log(`Skipping event: ${eventError.message}`);
          }
        }
        
        // Check if we need to paginate
        if (events.length < take) {
          break;
        }
        
        // Move to next page
        skip += take;
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error with domain ${domain}: ${error.message}`);
        break;
      }
    }
    
    console.log(`Total ${allEvents.length} events from ${domain}`);
    return allEvents;
  } catch (err) {
    console.log(`${brand} domain failed: ${err.message}`);
    return [];
  }
}

// Try all domains
export async function scrapeWithAlternateDomains() {
  console.log('Starting BetPawa multi-domain live event scraper');
  
  // Define domains to try in order
  const domains = [
    { domain: 'www.betpawa.ug', brand: 'uganda' },       // Uganda
    { domain: 'www.betpawa.com.gh', brand: 'ghana' },    // Ghana
    { domain: 'ke.betpawa.com', brand: 'kenya' }         // Kenya
  ];
  
  for (const { domain, brand } of domains) {
    try {
      const events = await scrapeWithDomain(domain, brand);
      if (events && events.length > 0) {
        console.log(`Success with ${domain}! Found ${events.length} live events`);
        return events;
      }
    } catch (err) {
      console.error(`Error with ${domain}: ${err.message}`);
    }
  }
  
  console.log("All domains failed for live events");
  return [];
}

// Direct test
export async function testScraper() {
  const events = await scrapeWithAlternateDomains();
  console.log(`Scraped ${events.length} live events total`);
  return events;
}