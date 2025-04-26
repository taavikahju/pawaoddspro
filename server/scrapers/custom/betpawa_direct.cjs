// Direct implementation based on the Python script
const axios = require('axios');

// Function to build the encoded query string with pagination parameters
function buildQueryString(skip, take = 20) {
  const query = {
    queries: [
      {
        query: {
          eventType: "LIVE",
          categories: [2],
          zones: {},
          hasOdds: true
        },
        view: {
          marketTypes: ["3743"]
        },
        skip: skip,
        take: take
      }
    ]
  };
  
  // Encode the query in the same format as the original
  return encodeURIComponent(JSON.stringify(query));
}

async function fetchEventsPage(skip) {
  try {
    const encoded_q = buildQueryString(skip);
    const url = `https://www.betpawa.com.gh/api/sportsbook/v2/events/lists/by-queries?q=${encoded_q}`;
    
    const headers = {
      "accept": "*/*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,la;q=0.7",
      "baggage": "sentry-environment=production,sentry-release=1.203.58,sentry-public_key=f051fd6f1fdd4877afd406a80df0ddb8,sentry-trace_id=69dc4eced394402e8b4842078bf03b47,sentry-sample_rate=0.1,sentry-transaction=Upcoming,sentry-sampled=false",
      "devicetype": "web",
      "if-modified-since": "Tue, 22 Apr 2025 16:29:07 GMT",
      "priority": "u=1, i",
      "referer": "https://www.betpawa.com.gh/events?marketId=1X2&categoryId=2",
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
      "x-pawa-brand": "betpawa-ghana",
      "x-pawa-language": "en"
    };
    
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

    // Convert cookies to string format
    let cookieString = '';
    for (const [key, value] of Object.entries(cookies)) {
      cookieString += `${key}=${value}; `;
    }
    headers.cookie = cookieString;

    const response = await axios.get(url, { headers });

    if (response.status !== 200) {
      return { events: [], moreAvailable: false };
    }

    const result = response.data;
    
    if (!result.responses || !result.responses[0] || !result.responses[0].responses) {
      return { events: [], moreAvailable: false };
    }
    
    const events = result.responses[0].responses;
    
    // Check if there might be more pages
    // If we got a full page of results, there might be more
    const moreAvailable = events.length === 20;
    
    return { events, moreAvailable };
  } catch (error) {
    return { events: [], moreAvailable: false };
  }
}

async function processEvents(events) {
  const processedEvents = [];
  
  for (const event of events) {
    try {
      // Find the widget with type SPORTRADAR
      const widget = event.widgets?.find(w => w.type === "SPORTRADAR");
      
      // Find the market with id "3743" (1X2 market)
      const market = event.markets?.find(m => m.marketType?.id === "3743");
      
      if (!widget || !market) {
        continue;
      }
      
      // Map prices by name (1, X, 2)
      const prices = {};
      for (const price of market.prices || []) {
        prices[price.name] = price.price;
      }

      // Check if all prices are 0.0 (option 2 for suspended)
      const home_odds = prices["1"] ? parseFloat(prices["1"]) : 0.0;
      const draw_odds = prices["X"] ? parseFloat(prices["X"]) : 0.0;
      const away_odds = prices["2"] ? parseFloat(prices["2"]) : 0.0;
      
      // Force some events to have all odds as 0.0 for testing suspensions
      const eventIdNumber = parseInt(widget.id);
      // Force suspension for every 5th event for testing
      const forceZeroOdds = (eventIdNumber % 5 === 0);
      
      // If this event should have zero odds, set them all to 0.0
      const finalHomeOdds = forceZeroOdds ? 0.0 : home_odds;
      const finalDrawOdds = forceZeroOdds ? 0.0 : draw_odds;
      const finalAwayOdds = forceZeroOdds ? 0.0 : away_odds;
      
      const isSuspended = finalHomeOdds === 0.0 && finalDrawOdds === 0.0 && finalAwayOdds === 0.0;
      
      // Log information about forced suspended events to stderr instead of stdout
      if (forceZeroOdds) {
        process.stderr.write(`[TEST] Forcing suspension for event ${widget.id} (${event.name}) with all odds set to 0.0\n`);
        process.stderr.write(`[TEST] Suspension status: ${isSuspended}\n`);
      }

      // Create an event object
      processedEvents.push({
        eventId: widget.id,
        country: event.region?.name,
        tournament: event.competition?.name,
        event: event.name,
        market: market.marketType?.name,
        home_odds: forceZeroOdds ? "0.0" : (prices["1"] ? prices["1"].toString() : "0.0"),
        draw_odds: forceZeroOdds ? "0.0" : (prices["X"] ? prices["X"].toString() : "0.0"),
        away_odds: forceZeroOdds ? "0.0" : (prices["2"] ? prices["2"].toString() : "0.0"),
        start_time: event.startTime,
        // Add extra fields needed for heartbeat
        gameMinute: event.scoreboard?.display?.minute || "1",
        suspended: isSuspended, // Use the all-0.0 check for suspension status
        homeTeam: event.name.split(" vs ")[0],
        awayTeam: event.name.split(" vs ")[1]
      });
    } catch (e) {
      // Skip this event if there's an error
    }
  }
  
  return processedEvents;
}

async function scrapeRealEvents() {
  try {
    const allEvents = [];
    let currentPage = 0;
    let moreAvailable = true;
    const PAGE_SIZE = 20;
    const MAX_PAGES = 5; // Limit to 5 pages to avoid excessive requests (up to 100 events)
    
    // Fetch pages until we've got all events or reached the maximum page limit
    while (moreAvailable && currentPage < MAX_PAGES) {
      const skip = currentPage * PAGE_SIZE;
      const { events, moreAvailable: hasMore } = await fetchEventsPage(skip);
      
      if (events.length === 0) {
        break;
      }
      
      const processedEvents = await processEvents(events);
      allEvents.push(...processedEvents);
      
      moreAvailable = hasMore;
      currentPage++;
      
      // Small delay between requests to avoid rate limiting
      if (moreAvailable) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return allEvents;
  } catch (error) {
    return [];
  }
}

// This is the function that will be called from outside
async function main() {
  try {
    const events = await scrapeRealEvents();
    // Only output the JSON, nothing else before or after
    process.stdout.write(JSON.stringify(events));
    return events;
  } catch (error) {
    // No console output
    process.stdout.write(JSON.stringify([]));
    return [];
  }
}

// Node.js script execution
if (require.main === module) {
  main().catch(() => {
    // No console output
    process.stdout.write(JSON.stringify([]));
    process.exit(1);
  });
} else {
  module.exports = main;
}