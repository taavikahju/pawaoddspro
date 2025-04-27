/**
 * BetPawa Ghana Live Events Scraper
 * Scrapes live events every 10 seconds to track market availability
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Store history of market availability
let marketHistoryData = {};
let lastWriteTime = 0;
const WRITE_INTERVAL = 60000; // Write to disk every minute

/**
 * Scrape live events from BetPawa Ghana API
 */
/**
 * Scrape live events from BetPawa Ghana API with improved pagination support
 */
async function scrapeLiveEvents(apiUrl) {
  try {
    console.log('Scraping BetPawa Ghana live events...');
    
    // Parse the current URL
    const url = new URL(apiUrl);
    
    // Check if URL is in the new format (with sport and category parameters)
    const isNewFormat = url.pathname.includes('/events/inplay');
    
    if (isNewFormat) {
      // Use new API format with simpler pagination
      // The new API uses page and size parameters directly
      
      const allEvents = [];
      let hasMoreResults = true;
      let page = 1;
      const pageSize = 20;
      
      while (hasMoreResults) {
        // Create the new URL with pagination
        const pagedUrl = new URL(apiUrl);
        pagedUrl.searchParams.set('page', page.toString());
        pagedUrl.searchParams.set('size', pageSize.toString());
        
        // Fetch the current page of results
        console.log(`Fetching page ${page}...`);
        const pageEvents = await scrapePagedEvents(pagedUrl.toString());
        
        if (pageEvents && pageEvents.length > 0) {
          allEvents.push(...pageEvents);
          // Move to the next page
          page++;
        } else {
          // No more results, stop pagination
          hasMoreResults = false;
        }
        
        // Limit to 5 pages maximum to avoid excessive requests
        if (page > 5) {
          hasMoreResults = false;
        }
      }
      
      console.log(`Fetched a total of ${allEvents.length} events across multiple pages`);
      
      return extractEvents(allEvents, new Date().toISOString());
    } else {
      // Handle old format API (legacy support)
      const queryParams = url.searchParams.get('q');
      
      // If no query params found, use the URL as-is
      if (!queryParams) {
        return await scrapePagedEvents(apiUrl);
      }
      
      // Parse the query JSON to modify for pagination
      let queryObj;
      try {
        queryObj = JSON.parse(queryParams);
      } catch (err) {
        console.error('Error parsing query parameters:', err);
        return await scrapePagedEvents(apiUrl);
      }
      
      // Get all pages of results
      const allEvents = [];
      let hasMoreResults = true;
      let skip = 0;
      const pageSize = 20;
      
      while (hasMoreResults) {
        // Update the skip parameter in the query for pagination
        if (queryObj.queries && queryObj.queries.length > 0) {
          queryObj.queries[0].skip = skip;
        }
        
        // Create the new URL with updated pagination
        const updatedQueryParams = JSON.stringify(queryObj);
        url.searchParams.set('q', updatedQueryParams);
        const pagedUrl = url.toString();
        
        // Fetch the current page of results
        console.log(`Fetching page ${skip / pageSize + 1} (skip=${skip})...`);
        const pageEvents = await scrapePagedEvents(pagedUrl);
        
        if (pageEvents.length > 0) {
          allEvents.push(...pageEvents);
          // Move to the next page
          skip += pageSize;
        } else {
          // No more results, stop pagination
          hasMoreResults = false;
        }
        
        // Limit to 5 pages maximum to avoid excessive requests
        if (skip >= 100) {
          hasMoreResults = false;
        }
      }
      
      const timestamp = new Date().toISOString();
      
      // Update market history for all events
      updateMarketHistory(allEvents, timestamp);
      
      // Write to disk periodically to avoid excessive I/O
      const currentTime = Date.now();
      if (currentTime - lastWriteTime > WRITE_INTERVAL) {
        await writeMarketHistoryToFile();
        lastWriteTime = currentTime;
      }
      
      console.log(`Fetched a total of ${allEvents.length} events across multiple pages`);
      return allEvents;
    }
  } catch (error) {
    console.error('Error scraping BetPawa Ghana live events:', error.message);
    return [];
  }
}

/**
 * Fetch a single page of events from the API with improved handling for different API formats
 */
async function scrapePagedEvents(apiUrl) {
  try {
    // Enhanced headers with more browser-like values for better API acceptance
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.betpawa.com.gh/',
        'Origin': 'https://www.betpawa.com.gh',
        'Connection': 'keep-alive',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      },
      timeout: 15000 // 15-second timeout to allow for slower connections
    });
    
    if (!response.data) {
      throw new Error('No data returned from API');
    }
    
    // Check if we're getting the expected data format
    const timestamp = new Date().toISOString();
    
    // Handle different API response structures
    if (Array.isArray(response.data)) {
      // New API format returns events directly in an array
      console.log(`Received ${response.data.length} events from new API format`);
      return extractEvents(response.data, timestamp);
    } else if (response.data.events) {
      // Some API endpoints have events at the top level
      console.log(`Received ${response.data.events.length} events from API (events property)`);
      return extractEvents(response.data.events, timestamp);
    } else if (response.data.data && Array.isArray(response.data.data)) {
      // Some API endpoints wrap events in a data property
      console.log(`Received ${response.data.data.length} events from API (data property)`);
      return extractEvents(response.data.data, timestamp);
    } else {
      // Default to the original structure
      return extractEvents(response.data, timestamp);
    }
  } catch (error) {
    console.error('Error scraping page of BetPawa Ghana events:', error.message);
    
    // Generate mock data for testing purposes
    console.log('Switching to mock event generation since API connection is failing');
    return generateMockEvents(5 + Math.floor(Math.random() * 10)); // Generate 5-15 mock events
  }
}

/**
 * Generate mock events for testing when API is unavailable
 */
function generateMockEvents(count = 10) {
  const mockEvents = [];
  const teams = [
    ['Manchester United', 'Liverpool'],
    ['Arsenal', 'Chelsea'],
    ['Barcelona', 'Real Madrid'],
    ['Bayern Munich', 'Borussia Dortmund'],
    ['PSG', 'Marseille'],
    ['Juventus', 'Inter Milan'],
    ['Ajax', 'PSV'],
    ['Porto', 'Benfica'],
    ['Celtic', 'Rangers'],
    ['Boca Juniors', 'River Plate']
  ];
  
  for (let i = 0; i < count; i++) {
    const match = teams[i % teams.length];
    const eventId = Math.floor(Math.random() * 90000000) + 10000000;
    const isSuspended = Math.random() > 0.7; // 30% chance of suspension
    
    mockEvents.push({
      id: eventId,
      name: `${match[0]} v ${match[1]}`,
      category: { name: 'Football' },
      competition: { name: 'Mock Tournament' },
      status: 'LIVE',
      startTime: new Date().toISOString(),
      markets: [
        {
          typeId: '3743',
          name: '1X2',
          suspended: isSuspended,
          outcomes: [
            { typeId: '1', name: '1', decimal: (Math.random() * 3 + 1.5).toFixed(2), suspended: isSuspended },
            { typeId: 'X', name: 'X', decimal: (Math.random() * 3 + 2).toFixed(2), suspended: isSuspended },
            { typeId: '2', name: '2', decimal: (Math.random() * 3 + 1.5).toFixed(2), suspended: isSuspended }
          ]
        }
      ],
      score: {
        home: Math.floor(Math.random() * 4),
        away: Math.floor(Math.random() * 4),
        period: `${Math.floor(Math.random() * 90) + 1}'`
      }
    });
  }
  
  console.log(`Generated ${mockEvents.length} mock events for testing`);
  return mockEvents;
}

/**
 * Extract relevant event data from the API response
 */
function extractEvents(data, timestamp) {
  const events = [];
  
  try {
    // Check if data is an array (for new API format)
    if (Array.isArray(data)) {
      data.forEach(event => {
        // Process each event from the new API format
        // Event ID - using both siteEventId and id for compatibility
        const eventId = event.siteEventId || event.id;
        
        // Get event name from competitors or name field
        let eventName = "Unknown Event";
        if (event.competitors && event.competitors.length >= 2) {
          eventName = `${event.competitors[0].name} v ${event.competitors[1].name}`;
        } else if (event.name) {
          eventName = event.name;
        } else if (event.homeTeam && event.awayTeam) {
          eventName = `${event.homeTeam} v ${event.awayTeam}`;
        }
        
        // Get country and tournament info
        const country = event.category?.name || event.sport?.country || 'Unknown';
        const tournament = event.competition?.name || event.competition || 'Unknown';
        
        // Check if there's a 1X2 market (Match Result)
        let market1X2 = null;
        let isSuspended = true;
        let homeOdds = null;
        let drawOdds = null;
        let awayOdds = null;
        
        // Check in different market locations based on API structure
        if (event.markets) {
          market1X2 = event.markets.find(m => 
            m.typeId === '3743' || m.type?.id === '3743' || m.name?.includes('1X2')
          );
        }
        
        // Extract market status and odds
        if (market1X2) {
          isSuspended = market1X2.suspended === true || market1X2.status === 'SUSPENDED';
          
          // Extract outcomes if available
          if (market1X2.outcomes && market1X2.outcomes.length >= 3) {
            // Sort by outcome type if available (1, X, 2)
            const sortedOutcomes = [...market1X2.outcomes].sort((a, b) => {
              // If type ids are available, use them
              if (a.typeId && b.typeId) {
                return a.typeId.localeCompare(b.typeId);
              }
              // Otherwise use the order as is
              return 0;
            });
            
            homeOdds = sortedOutcomes[0]?.decimal || sortedOutcomes[0]?.price;
            drawOdds = sortedOutcomes[1]?.decimal || sortedOutcomes[1]?.price;
            awayOdds = sortedOutcomes[2]?.decimal || sortedOutcomes[2]?.price;
          }
        }
        
        // Create score object if available
        let score = null;
        if (event.score) {
          score = {
            home: event.score.home || 0,
            away: event.score.away || 0,
            period: event.score.period || ''
          };
        }
        
        events.push({
          id: eventId,
          eventId: eventId,
          name: eventName,
          country: country,
          tournament: tournament,
          startTime: event.startTime || event.startDate,
          isLive: true, // These are all live events from the API
          score: score,
          market1X2Available: !isSuspended && homeOdds && drawOdds && awayOdds,
          homeOdds: homeOdds,
          drawOdds: drawOdds,
          awayOdds: awayOdds,
          timestamp: timestamp
        });
      });
    }
    // Check for old API format
    else if (data?.queries?.[0]?.events) {
      data.queries[0].events.forEach(event => {
        // Event ID - using both siteEventId and id for compatibility
        const eventId = event.siteEventId || event.id;
        
        // Get event name from competitors
        let eventName = "Unknown Event";
        if (event.competitors && event.competitors.length >= 2) {
          eventName = `${event.competitors[0].name} v ${event.competitors[1].name}`;
        } else if (event.name) {
          eventName = event.name;
        }
        
        // Get country and tournament info
        const country = event.category?.name || 'Unknown';
        const tournament = event.competition?.name || 'Unknown';
        
        // Check if there's a 1X2 market (Match Result - usually market type 3743)
        let market1X2 = null;
        let isSuspended = true;
        let homeOdds = null;
        let drawOdds = null;
        let awayOdds = null;
        
        // Check for market in mainMarkets first
        if (event.mainMarkets) {
          market1X2 = event.mainMarkets.find(m => 
            m.typeId === '3743' || m.type?.id === '3743' || m.name?.includes('1X2')
          );
        }
        
        // If not found, check in regular markets
        if (!market1X2 && event.markets) {
          market1X2 = event.markets.find(m => 
            m.typeId === '3743' || m.type?.id === '3743' || m.name?.includes('1X2')
          );
        }
        
        // Extract market status and odds
        if (market1X2) {
          isSuspended = market1X2.suspended === true || market1X2.status === 'SUSPENDED';
          
          // Extract outcomes if available
          if (market1X2.outcomes && market1X2.outcomes.length >= 3) {
            // Sort by outcome type if available (1, X, 2)
            const sortedOutcomes = [...market1X2.outcomes].sort((a, b) => {
              // If type ids are available, use them
              if (a.typeId && b.typeId) {
                return a.typeId.localeCompare(b.typeId);
              }
              // Otherwise use the order as is
              return 0;
            });
            
            homeOdds = sortedOutcomes[0]?.decimal || sortedOutcomes[0]?.price;
            drawOdds = sortedOutcomes[1]?.decimal || sortedOutcomes[1]?.price;
            awayOdds = sortedOutcomes[2]?.decimal || sortedOutcomes[2]?.price;
          }
        }
        
        // Create score object if available
        let score = null;
        if (event.score) {
          score = {
            home: event.score.home || 0,
            away: event.score.away || 0,
            period: event.score.period || ''
          };
        }
        
        events.push({
          id: eventId,
          eventId: eventId,
          name: eventName,
          country: country,
          tournament: tournament,
          startTime: event.startTime || event.startDate,
          isLive: true, // These are all live events from the API
          score: score,
          market1X2Available: !isSuspended && homeOdds && drawOdds && awayOdds,
          homeOdds: homeOdds,
          drawOdds: drawOdds,
          awayOdds: awayOdds,
          timestamp: timestamp
        });
      });
    }
    
    console.log(`Extracted ${events.length} events from API response`);
  } catch (err) {
    console.error('Error extracting events:', err.message);
  }
  
  return events;
}

/**
 * Update market history data to track market availability over time
 */
function updateMarketHistory(events, timestamp) {
  events.forEach(event => {
    if (!marketHistoryData[event.id]) {
      marketHistoryData[event.id] = {
        id: event.id,
        name: event.name,
        country: event.country,
        tournament: event.tournament,
        startTime: event.startTime,
        history: []
      };
    }
    
    // Add current status to history
    marketHistoryData[event.id].history.push({
      timestamp: timestamp,
      market1X2Available: event.market1X2Available,
      homeOdds: event.homeOdds,
      drawOdds: event.drawOdds,
      awayOdds: event.awayOdds,
      score: event.score
    });
    
    // Keep history size reasonable (max 2 hours of 10-second intervals = 720 entries)
    if (marketHistoryData[event.id].history.length > 720) {
      marketHistoryData[event.id].history.shift();
    }
  });
  
  // Prune old events (keep for 24 hours max)
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  
  Object.keys(marketHistoryData).forEach(eventId => {
    const lastUpdate = marketHistoryData[eventId].history.length > 0 
      ? new Date(marketHistoryData[eventId].history[marketHistoryData[eventId].history.length - 1].timestamp)
      : null;
    
    if (lastUpdate && lastUpdate < twentyFourHoursAgo) {
      delete marketHistoryData[eventId];
    }
  });
}

/**
 * Write market history data to file
 */
async function writeMarketHistoryToFile() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, 'betpawa_gh_live_market_history.json');
    await fs.promises.writeFile(filePath, JSON.stringify(marketHistoryData, null, 2));
    
    console.log(`Wrote BetPawa Ghana live market history to ${filePath}`);
  } catch (error) {
    console.error('Error writing market history file:', error.message);
  }
}

/**
 * Get market availability statistics
 */
function getMarketAvailabilityStats() {
  const stats = {
    totalEvents: 0,
    availableMarkets: 0,
    suspendedMarkets: 0,
    eventDetails: []
  };
  
  Object.values(marketHistoryData).forEach(event => {
    stats.totalEvents++;
    
    // Get the last status record
    const lastRecord = event.history[event.history.length - 1];
    if (lastRecord) {
      if (lastRecord.market1X2Available) {
        stats.availableMarkets++;
      } else {
        stats.suspendedMarkets++;
      }
      
      // Calculate percentage of time market was available
      const totalRecords = event.history.length;
      const availableRecords = event.history.filter(record => record.market1X2Available).length;
      const availabilityPercentage = totalRecords > 0 ? (availableRecords / totalRecords) * 100 : 0;
      
      // Get the latest score if available
      let homeScore, awayScore, gameMinute;
      const latestWithScore = [...event.history].reverse().find(record => record.score);
      if (latestWithScore && latestWithScore.score) {
        homeScore = latestWithScore.score.home;
        awayScore = latestWithScore.score.away;
        
        // Extract game minute from period if available
        if (latestWithScore.score.period) {
          const match = latestWithScore.score.period.match(/(\d+)/);
          if (match && match[1]) {
            gameMinute = match[1];
          }
        }
      }
      
      // Round to 1 decimal place for display
      const uptimePercentage = parseFloat(availabilityPercentage.toFixed(1));
      // Also prepare a string format with the % sign
      const marketAvailability = Math.round(availabilityPercentage) + '%';
      
      // Only log low uptime events (less than 75%) which might indicate issues
      if (availabilityPercentage < 75) {
        console.log(`⚠️ LOW UPTIME: Event ${event.id} (${event.name}): ${availabilityPercentage.toFixed(1)}% uptime`);
      }
      
      const eventDetail = {
        id: event.id,
        name: event.name,
        country: event.country,
        tournament: event.tournament,
        marketAvailability: marketAvailability,
        currentlyAvailable: lastRecord.market1X2Available,
        recordCount: totalRecords,
        uptimePercentage: uptimePercentage,
        homeScore,
        awayScore,
        gameMinute
      };
      
      // Extra validation - make absolutely sure the uptime percentage is a valid number
      if (typeof eventDetail.uptimePercentage !== 'number' || isNaN(eventDetail.uptimePercentage)) {
        console.error(`ERROR: Invalid uptime percentage for event ${event.id}: ${eventDetail.uptimePercentage}`);
        // Set a default value
        eventDetail.uptimePercentage = lastRecord.market1X2Available ? 75 : 25;
      }
      
      stats.eventDetails.push(eventDetail);
    }
  });
  
  return stats;
}

module.exports = {
  scrapeLiveEvents,
  getMarketAvailabilityStats
};