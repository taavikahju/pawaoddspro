// Direct implementation based on the Python script
const axios = require('axios');

async function scrapeRealEvents() {
  try {
    // Replace UPCOMING with LIVE in the endpoint
    const encoded_q = "%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A0%2C%22take%22%3A20%7D%5D%7D";
    const url = `https://www.betpawa.com.gh/api/sportsbook/v2/events/lists/by-queries?q=${encoded_q}`;

    console.log(`Fetching events from ${url}...`);
    
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
      console.error(`Request failed with status ${response.status}`);
      return [];
    }

    const result = response.data;
    
    if (!result.responses || !result.responses[0] || !result.responses[0].responses) {
      console.error('Invalid response structure');
      return [];
    }
    
    const events = result.responses[0].responses;
    console.log(`Found ${events.length} events`);

    const allEvents = [];

    for (const event of events) {
      try {
        // Find the widget with type SPORTRADAR, similar to Python script
        const widget = event.widgets?.find(w => w.type === "SPORTRADAR");
        
        // Find the market with id "3743" (1X2 market)
        const market = event.markets?.find(m => m.marketType?.id === "3743");
        
        if (!widget || !market) {
          console.log('Skipping event - missing widget or market');
          continue;
        }
        
        // Map prices by name (1, X, 2) - same as Python script
        const prices = {};
        for (const price of market.prices || []) {
          prices[price.name] = price.price;
        }

        // Create an event object similar to Python script
        allEvents.push({
          eventId: widget.id,
          country: event.region?.name,
          tournament: event.competition?.name,
          event: event.name,
          market: market.marketType?.name,
          home_odds: prices["1"] ? prices["1"].toString() : "",
          draw_odds: prices["X"] ? prices["X"].toString() : "",
          away_odds: prices["2"] ? prices["2"].toString() : "",
          start_time: event.startTime,
          // Add extra fields needed for heartbeat
          gameMinute: event.scoreboard?.display?.minute,
          suspended: market.suspended === true,
          homeTeam: event.name.split(" vs ")[0],
          awayTeam: event.name.split(" vs ")[1]
        });
      } catch (e) {
        console.error(`Skipping event due to error: ${e.message}`);
      }
    }

    console.log(`Successfully processed ${allEvents.length} events`);
    return allEvents;
  } catch (error) {
    console.error('Error scraping events:', error.message);
    return [];
  }
}

// This is the function that will be called from outside
async function main() {
  const events = await scrapeRealEvents();
  console.log(JSON.stringify(events));
  return events;
}

// Node.js script execution
if (require.main === module) {
  main().catch(console.error);
} else {
  module.exports = main;
}