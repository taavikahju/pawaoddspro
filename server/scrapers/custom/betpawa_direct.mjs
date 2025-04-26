/**
 * Direct implementation of the Python script approach for BetPawa scraping
 * JavaScript ES Modules version that avoids using crypto.randomBytes
 */

import axios from 'axios';

// BetPawa domain variants to try in order (following the Python script approach)
const BETPAWA_DOMAINS = [
  { domain: 'www.betpawa.ug', brand: 'uganda' },       // Uganda  
  { domain: 'www.betpawa.com.gh', brand: 'ghana' },    // Ghana
  { domain: 'ke.betpawa.com', brand: 'kenya' }         // Kenya
];

/**
 * Main scraper function for BetPawa live events
 */
export async function scrapeBetPawa() {
  console.log('Starting BetPawa live events scraper (ES modules version)');
  
  // Try all domains until we find one that works
  for (const { domain, brand } of BETPAWA_DOMAINS) {
    try {
      const events = await scrapeWithDomain(domain, brand);
      if (events && events.length > 0) {
        console.log(`Success with ${domain}! Found ${events.length} live events`);
        return events;
      }
    } catch (error) {
      console.error(`Error with ${domain}: ${error.message}`);
    }
  }
  
  console.log('All BetPawa domains failed');
  return [];
}

/**
 * Try all domains in sequence until one succeeds
 */
export async function scrapeWithAlternateDomains() {
  return await scrapeBetPawa();
}

/**
 * Scrape one specific domain
 */
async function scrapeWithDomain(domain, brand) {
  try {
    console.log(`Trying BetPawa ${brand} domain (${domain})...`);
    
    // Create headers based on Python script
    const headers = {
      "accept": "*/*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,la;q=0.7",
      "baggage": "sentry-environment=production,sentry-release=1.203.58,sentry-public_key=f051fd6f1fdd4877afd406a80df0ddb8,sentry-trace_id=69dc4eced394402e8b4842078bf03b47,sentry-sample_rate=0.1,sentry-transaction=Upcoming,sentry-sampled=false",
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
    
    // Use fixed cookies instead of generating with crypto
    const cookies = {
      "_ga": "GA1.1.459857438.1713161475",
      "_ga_608WPEPCC3": "GS1.1.1731480684.7.0.1731480684.0.0.0",
      "aff_cookie": "F60",
      "_gcl_au": "1.1.1725251410.1738666716",
      "PHPSESSID": "b0694dabe05179bc223abcdf8f7bf83e",
      "tracingId": "0f5927de-e30d-4228-b29c-c92210017a62",
      "x-pawa-token": "b4c6eda2ae319f4b-8a3075ba3c9d9984",
      "cf_clearance": "DjcwCGXGFkKOCvAa7tthq5gHd2OnDjc9YCNhMNiDvtA-1745326277-1.2.1.1-4gXeQQAJCLcc73SQfF5WbdmY2stVELoIXQ4tNlEqXQ0YXVQexCJyNKBDdmSZPCEsPbDSCyZ9Dq44i6QG9pmnHaPl6oqYLOYRPyyGksyRWjy7XVmbseQZR1hRppEkLe.7dz9mbrh9M4.i4Yacl75TmAvcpO_gneOw9053uogjahyJiTXWfAjtuWaM1MHey5z8kKPCRJV.yHO84079d6Bjxjg0e8H7rZQYzBqV2uVOC6hc5gMFcXLn3r9VJtyQlXT1i2ZEGgk2etljGYq28fPXWB7ACaZDUxpSH9ufodLbNbWF0uXfJbB_uCLTkyh3e05.eW2AZ61JkrDY5JUO1Z9bLUJg29DoAi0rVMAu.XHUX_c",
      "__cf_bm": "GWFTquZa.ZseXCY1d0MojQJ5ioXLrt9Kzpw9Ys1VK.Y-1745339708-1.0.1.1-fuzWFb1qmUZL9JpleqcSQbFzUdv16bOpJFyE.zXq45luhtH40Q.Ow4FzDOJpSrLDa4Zw9eBJKYmqAh.mYKYnlwRSmU9CFdGAY5YOHJdUqAg",
      "_ga_81NDDTKQDC": "GS1.1.1745339340.454.1.1745340303.60.0.0"
    };
    
    // Convert cookies to string
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    
    // Add cookies to headers
    const headerWithCookies = {
      ...headers,
      cookie: cookieString
    };
    
    // Parameters for pagination following the Python script approach
    const allEvents = [];
    const take = 20;
    let skip = 0;
    
    // Build query parameter - specifically for LIVE events with football (category 2)
    const encodedQuery = `%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A${skip}%2C%22take%22%3A${take}%7D%5D%7D`;
    
    // API endpoint
    const apiUrl = `https://${domain}/api/sportsbook/v2/events/lists/by-queries?q=${encodedQuery}`;
    
    console.log(`Fetching live events from: ${apiUrl}`);
    
    // Make request
    const response = await axios.get(apiUrl, {
      headers: headerWithCookies,
      timeout: 20000
    });
    
    // Check for valid response
    if (response.status !== 200) {
      console.error(`Request failed with status ${response.status}`);
      return [];
    }
    
    // Parse events from response - different APIs might return data in different structures
    let events = [];
    
    // Log the response structure for debugging
    console.log('Response data keys:', Object.keys(response.data));
    if (response.data?.responses) {
      console.log('responses array length:', response.data.responses.length);
      console.log('First response keys:', response.data.responses[0] ? Object.keys(response.data.responses[0]) : 'none');
    }
    
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
    
    if (!events || events.length === 0) {
      console.log('No live events found');
      return [];
    }
    
    console.log(`Found ${events.length} live events`);
    
    // Process events following the Python script approach
    for (const event of events) {
      try {
        // Get SportRadar widget ID
        const widget = event.widgets?.find(w => w.type === 'SPORTRADAR');
        const widgetId = widget?.id || '';
        
        // Find the 1X2 market (market type 3743)
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
        
        // Create event object in the format needed for the heartbeat tracker
        // Determine real market availability - a market is available only if at least one price is not suspended
        let isMarketAvailable = false;
        if (market) {
          // Check if at least one price is not suspended
          if (homeOdds && drawOdds && awayOdds) {
            isMarketAvailable = true;
          }
          
          // Check market suspended property explicitly
          if (market.suspended === true || market.status === 'SUSPENDED') {
            isMarketAvailable = false;
          }
          
          // Check if all individual prices are suspended
          const prices = market.prices || [];
          if (prices.length > 0) {
            const allPricesSuspended = prices.every(p => p.suspended === true);
            if (allPricesSuspended) {
              isMarketAvailable = false;
            }
          }
        }
        
        const eventObject = {
          id: event.id,
          eventId: widgetId || event.id || '',
          country: event.region?.name || event.category?.name || 'Unknown',
          tournament: event.competition?.name || event.league?.name || 'Unknown',
          event: event.name || `${homeTeam} vs ${awayTeam}`,
          home_team: homeTeam,
          away_team: awayTeam,
          home_odds: homeOdds,
          draw_odds: drawOdds,
          away_odds: awayOdds,
          isInPlay: true,
          status: 'LIVE',
          market_status: isMarketAvailable ? 'AVAILABLE' : 'SUSPENDED',
          market_available: isMarketAvailable,
          start_time: event.startTime || new Date().toISOString(),
          game_minute: event.scoreboard?.display?.minute || '',
          widget_id: widgetId
        };
        
        allEvents.push(eventObject);
      } catch (eventError) {
        console.error(`Error processing event: ${eventError.message}`);
      }
    }
    
    console.log(`Successfully scraped ${allEvents.length} live events from ${domain}`);
    return allEvents;
  } catch (error) {
    console.error(`Error scraping ${domain}: ${error.message}`);
    return [];
  }
}

// Test function
export async function testScraper() {
  const events = await scrapeBetPawa();
  console.log(`Scraped ${events.length} total live events`);
  return events;
}