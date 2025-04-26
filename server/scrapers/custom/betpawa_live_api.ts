import axios from 'axios';

/**
 * A specialized function to fetch live events from BetPawa Ghana's API
 * with precise headers and configuration that is known to work properly
 */
export async function fetchBetPawaLiveEvents() {
  try {
    // The URL provided by the user that is known to work
    const url = 'https://www.betpawa.com.gh/api/sportsbook/v2/events/lists/by-queries?q=%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B%222%22%5D%2C%22zones%22%3A%7B%7D%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A0%2C%22sort%22%3A%7B%22competitionPriority%22%3A%22DESC%22%7D%2C%22take%22%3A20%7D%5D%7D';
    
    // Domain for constructing headers
    const domain = 'www.betpawa.com.gh';
    const brand = 'ghana';
    
    // Headers from bp_gh_live_scraper.js that work
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://${domain}/`,
      'Origin': `https://${domain}`,
      'Connection': 'keep-alive',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'x-pawa-brand': `betpawa-${brand}`,
      // Cookies in header format
      'cookie': '_ga=GA1.1.459857438.1713161475; _ga_608WPEPCC3=GS1.1.1731480684.7.0.1731480684.0.0.0; aff_cookie=F60; _gcl_au=1.1.1725251410.1738666716; PHPSESSID=b0694dabe05179bc223abcdf8f7bf83e; tracingId=0f5927de-e30d-4228-b29c-c92210017a62; x-pawa-token=b4c6eda2ae319f4b-8a3075ba3c9d9984'
    };
    
    console.log('Making request to BetPawa Ghana API...');
    
    // Add cache busting timestamp parameter
    const timestamp = Date.now();
    const apiUrl = `${url}&_cacheBust=${timestamp}`;
    
    const response = await axios.get(apiUrl, {
      headers,
      timeout: 30000
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const data = response.data;
    console.log('API response structure:', Object.keys(data));
    
    let events: any[] = [];
    
    // Handle the 'responses' structure which is what this endpoint returns
    if (data.responses && Array.isArray(data.responses)) {
      console.log(`Found responses array with ${data.responses.length} items`);
      
      // Extract events from responses structure
      for (const response of data.responses) {
        if (response.events && Array.isArray(response.events)) {
          events.push(...response.events);
        } else if (response.data && response.data.events && Array.isArray(response.data.events)) {
          events.push(...response.data.events);
        } else if (response.queries && Array.isArray(response.queries)) {
          for (const query of response.queries) {
            if (query.events && Array.isArray(query.events)) {
              events.push(...query.events);
            }
          }
        }
      }
    } else if (data.queries && Array.isArray(data.queries)) {
      // Handle queries structure directly
      for (const query of data.queries) {
        if (query.events && Array.isArray(query.events)) {
          events.push(...query.events);
        }
      }
    } else if (data.events && Array.isArray(data.events)) {
      // Direct events array
      events = data.events;
    }
    
    console.log(`Successfully extracted ${events.length} events from BetPawa API response`);
    return events;
  } catch (error: any) {
    console.error('Error fetching from BetPawa API:', error.message);
    if (axios.isAxiosError(error) && error.response) {
      console.error('API response details:');
      console.error(`- Status: ${error.response.status}`);
      console.error(`- Data: ${JSON.stringify(error.response.data).substring(0, 300)}...`);
    }
    
    // Return empty array on error
    return [];
  }
}

/**
 * Try an alternative endpoint to fetch football live events
 */
export async function fetchBetPawaFootballLive() {
  try {
    const domain = 'www.betpawa.com.gh';
    const brand = 'ghana';
    const timestamp = Date.now();
    const url = `https://${domain}/api/sportsbook/events/live/football?_=${timestamp}`;
    
    // Headers from bp_gh_live_scraper.js that work
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://${domain}/`,
      'Origin': `https://${domain}`,
      'Connection': 'keep-alive',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'x-pawa-brand': `betpawa-${brand}`,
      // Cookies in header format
      'cookie': '_ga=GA1.1.459857438.1713161475; _ga_608WPEPCC3=GS1.1.1731480684.7.0.1731480684.0.0.0; aff_cookie=F60; _gcl_au=1.1.1725251410.1738666716; PHPSESSID=b0694dabe05179bc223abcdf8f7bf83e; tracingId=0f5927de-e30d-4228-b29c-c92210017a62; x-pawa-token=b4c6eda2ae319f4b-8a3075ba3c9d9984'
    };
    
    console.log(`Trying alternative football endpoint: ${url}`);
    
    const response = await axios.get(url, {
      headers,
      timeout: 30000
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    // Log and return the data for further processing
    console.log(`Football endpoint returned status ${response.status}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching from football endpoint:', error.message);
    return null;
  }
}

/**
 * Parse events into a standard format for the heartbeat system
 */
export function parseEventsForHeartbeat(events: any[]) {
  return events.map(event => {
    try {
      // Extract event ID - BetPawa API may use different structures
      const eventId = event.id?.toString() || 
                     event.eventId?.toString() || 
                     event.fixture?.id?.toString();
      
      if (!eventId) {
        return null;
      }
      
      // Extract event name - BetPawa API may have teams in different properties
      let eventName = "";
      let homeTeam = "";
      let awayTeam = "";
      
      // Try to get home and away team names from various possible properties
      if (event.fixture?.homeName && event.fixture?.awayName) {
        homeTeam = event.fixture.homeName;
        awayTeam = event.fixture.awayName;
        eventName = `${homeTeam} vs ${awayTeam}`;
      } else if (event.homeTeam && event.awayTeam) {
        homeTeam = event.homeTeam;
        awayTeam = event.awayTeam;
        eventName = `${homeTeam} vs ${awayTeam}`;
      } else if (event.name && event.name.includes(" vs ")) {
        eventName = event.name;
        const parts = eventName.split(" vs ");
        homeTeam = parts[0].trim();
        awayTeam = parts[1].trim();
      } else if (event.fixture?.name) {
        eventName = event.fixture.name;
        if (eventName.includes(" vs ")) {
          const parts = eventName.split(" vs ");
          homeTeam = parts[0].trim();
          awayTeam = parts[1].trim();
        }
      } else {
        // Fallback to event name or default
        eventName = event.name || "Unknown Event";
      }
      
      // Extract location information
      const country = event.category?.name || 
                    event.tournament?.category?.name || 
                    event.fixture?.tournament?.category?.name || 
                    event.region?.name || 
                    "Unknown";
                    
      const tournament = event.competition?.name || 
                       event.tournament?.name || 
                       event.fixture?.tournament?.name || 
                       "Unknown";
      
      // Check market availability - BetPawa API has different structures for markets
      let isMarketAvailable = false;
      
      // Check different possible market structures
      if (event.markets && event.markets.length > 0) {
        // Classic market structure
        isMarketAvailable = !event.markets[0].suspended;
      } else if (event.fixture?.markets && event.fixture.markets.length > 0) {
        // Alternative market structure
        isMarketAvailable = !event.fixture.markets[0].suspended;
      } else if (event.bettingStatus === "AVAILABLE") {
        // Direct betting status property
        isMarketAvailable = true;
      } else if (event.status === "ACTIVE" || event.status === "OPEN") {
        // Status property
        isMarketAvailable = true;
      }
      
      // Get the game minute from the event data - check multiple possible structures
      const gameMinute = event.scoreboard?.display?.minute || 
                      event.fixture?.timer?.minute?.toString() || 
                      event.minute?.toString() || 
                      event.time?.toString() || 
                      event.matchTime?.toString() || 
                      "1";
      
      // Return the standardized event
      return {
        id: eventId,
        name: eventName,
        country: country,
        tournament: tournament,
        isInPlay: true,
        startTime: event.startTime || event.fixture?.startTime || new Date().toISOString(),
        currentlyAvailable: isMarketAvailable,
        marketAvailability: isMarketAvailable ? "ACTIVE" : "SUSPENDED",
        recordCount: 1,
        gameMinute: gameMinute,
        widgetId: event.widget?.id || event.id?.toString() || "",
        homeTeam: homeTeam,
        awayTeam: awayTeam
      };
    } catch (error) {
      console.error('Error parsing event:', error);
      return null;
    }
  }).filter(Boolean); // Filter out null values
}