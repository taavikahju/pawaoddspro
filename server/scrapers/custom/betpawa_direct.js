// This is a direct JavaScript implementation of the Python script
// that successfully scrapes BetPawa data, customized for the heartbeat endpoint

const axios = require('axios');
const fs = require('fs').promises;

// Same setup as the Python script but with the endpoint provided by the user
async function scrapeBetPawa() {
  const allEvents = [];
  const take = 20;
  let skip = 0;

  // Use the exact same URL structure and encoding format from Python
  try {
    while (true) {
      // This is the exact same encoded query format from the Python script but we're using LIVE instead of UPCOMING
      const encodedQuery = "%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3ASKIP_PLACEHOLDER%2C%22take%22%3A20%7D%5D%7D"
        .replace("SKIP_PLACEHOLDER", skip.toString());
      
      // Use the specific endpoint URL provided for heartbeat as specified by user
      const url = `https://www.betpawa.ug/api/sportsbook/v2/events/lists/by-queries?q=${encodedQuery}`;
      
      console.log(`Fetching data from ${url}...`);
      
      // Use the exact same headers from the Python script but update for Uganda endpoint
      const headers = {
        "accept": "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,la;q=0.7",
        "baggage": "sentry-environment=production,sentry-release=1.203.58,sentry-public_key=f051fd6f1fdd4877afd406a80df0ddb8,sentry-trace_id=69dc4eced394402e8b4842078bf03b47,sentry-sample_rate=0.1,sentry-transaction=Upcoming,sentry-sampled=false",
        "devicetype": "web",
        "if-modified-since": new Date().toUTCString(),
        "priority": "u=1, i",
        "referer": "https://www.betpawa.ug/events?marketId=1X2&categoryId=2",
        "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sentry-trace": "69dc4eced394402e8b4842078bf03b47-982bacd1c87283b4-0",
        "traceid": "1ecc4dce-f388-46a2-8275-0acddeffcf4d",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "vuejs": "true",
        "x-pawa-brand": "betpawa-uganda", // Changed from ghana to uganda
        "x-pawa-language": "en"
      };
      
      // Use cookies from the Python script
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
      
      // Convert cookies object to cookie string for axios
      const cookieString = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      
      headers['cookie'] = cookieString;
      
      try {
        const response = await axios.get(url, { headers });
        
        if (response.status !== 200) {
          console.log(`Request failed with status ${response.status}`);
          break;
        }
        
        // Extract events using the same approach as the Python script
        let events = [];
        
        try {
          // Trying to mimic the Python script's extraction logic
          const result = response.data;
          
          if (result && result.responses && result.responses[0] && result.responses[0].responses) {
            events = result.responses[0].responses;
          } else if (result && result.queries && result.queries[0] && result.queries[0].events) {
            // Alternative path
            events = result.queries[0].events;
          }
          
          if (!events || events.length === 0) {
            console.log("No more events found. Stopping.");
            break;
          }
          
          // Process events like the Python script
          for (const event of events) {
            try {
              // Extract SPORTRADAR widget for ID
              const widget = event.widgets?.find(w => w.type === 'SPORTRADAR');
              
              // Get the 1X2 market
              const market = event.markets?.find(m => m.marketType?.id === '3743');
              
              // Extract prices like the Python script
              const prices = {};
              if (market && market.prices) {
                for (const p of market.prices) {
                  prices[p.name] = p.price;
                }
              }
              
              // Create event object with same structure as Python script
              allEvents.push({
                eventId: widget ? widget.id : (event.id || ''),
                country: event.region?.name || 'Unknown',
                tournament: event.competition?.name || 'Unknown',
                event: event.name || 'Unknown Event',
                market: market?.marketType?.name || '1X2',
                home_odds: prices['1'] ? String(prices['1']) : '',
                draw_odds: prices['X'] ? String(prices['X']) : '',
                away_odds: prices['2'] ? String(prices['2']) : '',
                start_time: event.startTime ? new Date(event.startTime).toISOString().replace('T', ' ').substring(0, 16) : ''
              });
            } catch (err) {
              console.log(`Skipping event due to error: ${err.message}`);
            }
          }
          
          // Increment skip for pagination
          skip += take;
          
          // Add a small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (err) {
          console.error(`Error processing response: ${err.message}`);
          break;
        }
      } catch (err) {
        console.error(`Request error: ${err.message}`);
        break;
      }
    }
    
    // Save results to file
    console.log(`Successfully scraped ${allEvents.length} events`);
    await fs.writeFile('Betpawa_LIVE_Data.json', JSON.stringify(allEvents, null, 2));
    
    // Return the events for direct use
    return allEvents;
    
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    return [];
  }
}

// Simple method to modify URL and brand based on domain
async function scrapeWithDomain(domain, brand) {
  try {
    console.log(`Trying BetPawa ${brand} domain (${domain})...`);
    
    // Use domain and brand for this attempt
    const allEvents = [];
    const take = 20;
    let skip = 0;
    
    try {
      while (true) {
        // Same query format as before but with the new domain
        const encodedQuery = "%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3ASKIP_PLACEHOLDER%2C%22take%22%3A20%7D%5D%7D"
          .replace("SKIP_PLACEHOLDER", skip.toString());
        
        const url = `https://${domain}/api/sportsbook/v2/events/lists/by-queries?q=${encodedQuery}`;
        
        console.log(`Fetching data from ${url}...`);
        
        // Headers with correct domain and brand
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
          "traceid": "1ecc4dce-f388-46a2-8275-0acddeffcf4d",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
          "vuejs": "true",
          "x-pawa-brand": `betpawa-${brand}`,
          "x-pawa-language": "en"
        };
        
        // Same cookies as before
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
        
        // Convert cookies
        const cookieString = Object.entries(cookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ');
        
        headers['cookie'] = cookieString;
        
        // Make the request
        const response = await axios.get(url, { headers });
        
        if (response.status !== 200) {
          console.log(`Request failed with status ${response.status}`);
          break;
        }
        
        // Process the response - same as before
        let events = [];
        
        if (response.data && response.data.responses && response.data.responses[0] && response.data.responses[0].responses) {
          events = response.data.responses[0].responses;
        } else if (response.data && response.data.queries && response.data.queries[0] && response.data.queries[0].events) {
          events = response.data.queries[0].events;
        }
        
        if (!events || events.length === 0) {
          console.log("No more events found. Stopping.");
          break;
        }
        
        // Process each event and add to allEvents - same code as before
        for (const event of events) {
          try {
            const widget = event.widgets?.find(w => w.type === 'SPORTRADAR');
            const market = event.markets?.find(m => m.marketType?.id === '3743');
            const prices = {};
            
            if (market && market.prices) {
              for (const p of market.prices) {
                prices[p.name] = p.price;
              }
            }
            
            allEvents.push({
              eventId: widget ? widget.id : (event.id || ''),
              country: event.region?.name || 'Unknown',
              tournament: event.competition?.name || 'Unknown',
              event: event.name || 'Unknown Event',
              market: market?.marketType?.name || '1X2',
              home_odds: prices['1'] ? String(prices['1']) : '',
              draw_odds: prices['X'] ? String(prices['X']) : '',
              away_odds: prices['2'] ? String(prices['2']) : '',
              start_time: event.startTime ? new Date(event.startTime).toISOString().replace('T', ' ').substring(0, 16) : ''
            });
          } catch (err) {
            console.log(`Skipping event due to error: ${err.message}`);
          }
        }
        
        // Increment skip for pagination
        skip += take;
        
        // Add a small delay
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.log(`Successfully scraped ${allEvents.length} events from ${domain}`);
      return allEvents;
      
    } catch (err) {
      console.error(`Error processing domain ${domain}: ${err.message}`);
      throw err;
    }
  } catch (err) {
    console.log(`${brand} domain failed: ${err.message}`);
    return null;
  }
}

// Try alternate domains if the main one fails
async function scrapeWithAlternateDomains() {
  // Define domains to try in preferred order
  const domains = [
    { domain: 'www.betpawa.ug', brand: 'uganda' },       // Uganda
    { domain: 'www.betpawa.com.gh', brand: 'ghana' },    // Ghana
    { domain: 'ke.betpawa.com', brand: 'kenya' }         // Kenya
  ];
  
  // Try each domain in sequence until one works
  for (const { domain, brand } of domains) {
    const events = await scrapeWithDomain(domain, brand);
    if (events && events.length > 0) {
      return events;
    }
  }
  
  // If all domains failed, return empty array
  console.log("All domains failed, returning empty array");
  return [];
}

// Export the function to be used in the heartbeat scraper
module.exports = { 
  scrapeBetPawa,
  scrapeWithAlternateDomains
};

// If this is run directly, execute the scraper
if (require.main === module) {
  scrapeWithAlternateDomains().then(events => {
    console.log(`Total events scraped: ${events.length}`);
  });
}