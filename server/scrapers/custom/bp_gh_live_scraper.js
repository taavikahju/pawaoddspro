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
async function scrapeLiveEvents(apiUrl) {
  try {
    console.log('Scraping BetPawa Ghana live events...');
    
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 8000 // 8-second timeout
    });
    
    if (!response.data) {
      throw new Error('No data returned from API');
    }
    
    const timestamp = new Date().toISOString();
    const events = extractEvents(response.data, timestamp);
    
    // Update market history
    updateMarketHistory(events, timestamp);
    
    // Write to disk periodically to avoid excessive I/O
    const currentTime = Date.now();
    if (currentTime - lastWriteTime > WRITE_INTERVAL) {
      await writeMarketHistoryToFile();
      lastWriteTime = currentTime;
    }
    
    return events;
  } catch (error) {
    console.error('Error scraping BetPawa Ghana live events:', error.message);
    return [];
  }
}

/**
 * Extract relevant event data from the API response
 */
function extractEvents(data, timestamp) {
  const events = [];
  
  try {
    // Logic to extract events will depend on the actual API response structure
    // This is a placeholder until we see the actual API structure
    if (data.events) {
      data.events.forEach(event => {
        // Check if there's a 1X2 market (match result)
        const market1X2 = event.markets?.find(m => 
          m.type === '1X2' || m.id === '1' || m.name?.includes('Match Result')
        );
        
        const isSuspended = market1X2?.suspended === true;
        const hasOdds = market1X2?.outcomes && market1X2.outcomes.length >= 3;
        
        events.push({
          id: event.id,
          eventId: event.id,
          name: event.name,
          country: event.country || event.tournament?.country || 'Unknown',
          tournament: event.tournament?.name || 'Unknown',
          startTime: event.startTime || event.date,
          isLive: event.isLive || event.inPlay || false,
          score: event.score || null,
          market1X2Available: !isSuspended && hasOdds,
          homeOdds: hasOdds ? market1X2.outcomes[0]?.price : null,
          drawOdds: hasOdds ? market1X2.outcomes[1]?.price : null,
          awayOdds: hasOdds ? market1X2.outcomes[2]?.price : null,
          timestamp: timestamp
        });
      });
    }
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
      
      stats.eventDetails.push({
        id: event.id,
        name: event.name,
        country: event.country,
        tournament: event.tournament,
        marketAvailability: Math.round(availabilityPercentage) + '%',
        currentlyAvailable: lastRecord.market1X2Available,
        recordCount: totalRecords
      });
    }
  });
  
  return stats;
}

module.exports = {
  scrapeLiveEvents,
  getMarketAvailabilityStats
};