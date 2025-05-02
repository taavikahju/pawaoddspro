import { IStorage } from '../storage';
import { logger } from './logger';

// Helper function to fix Sportybet data automatically after scraping
/**
 * Helper function to get Premier League events data.
 * This is used for diagnostics and debugging.
 */
export async function getPremierLeagueData(storage: IStorage): Promise<any> {
  const sportyData = await storage.getBookmakerData('sporty', true);
  
  if (!Array.isArray(sportyData)) {
    return {
      totalEvents: 0,
      premierLeagueCount: 0,
      premierLeagueEvents: []
    };
  }

  // Get all Premier League events from Sportybet data
  const premierLeagueEvents = sportyData.filter(event => {
    const country = event.country || (event.raw && event.raw.country) || '';
    const tournament = event.tournament || event.league || (event.raw && event.raw.tournament) || '';
    return country === 'England' && tournament === 'Premier League';
  }).map(event => {
    const teams = event.teams || event.event || (event.raw && event.raw.event) || '';
    const eventId = event.eventId || event.id || (event.raw && event.raw.originalEventId) || (event.raw && event.raw.eventId) || '';
    const odds = event.odds || {
      home: event.raw?.home_odds || 0,
      draw: event.raw?.draw_odds || 0,
      away: event.raw?.away_odds || 0
    };
    
    return {
      country: 'England',
      tournament: 'Premier League',
      teams,
      eventId,
      odds
    };
  });
  
  return {
    totalEvents: sportyData.length,
    premierLeagueCount: premierLeagueEvents.length,
    premierLeagueEvents
  };
}

export async function fixSportybetData(storage: IStorage): Promise<void> {
  logger.critical(`Running automatic Sportybet data fix`);
  
  try {
    // Get Sportybet data from file with force fresh
    const sportyData = await storage.getBookmakerData('sporty', true);
    if (!Array.isArray(sportyData) || sportyData.length === 0) {
      logger.critical(`No Sportybet data found in file during automatic fix`);
      return;
    }
    
    logger.critical(`Raw Sportybet data check: ${sportyData.length} events found in file`);
    
    // Get existing events from the database
    const allEvents = await storage.getEvents();
    const eventsWithSportybet = allEvents.filter(event => 
      event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData
    );
    
    // If we already have most of the Sportybet events, no need to run the fix
    // Temporarily disabled for testing our Premier League detection
    if (false && eventsWithSportybet.length >= sportyData.length * 0.9) {
      logger.critical(`Sportybet data already up to date (${eventsWithSportybet.length} / ${sportyData.length} events)`);
      return;
    }
    
    logger.critical(`Forcing Sportybet processing to test Premier League detection...`);
    
    // Create a set of eventIds that already have Sportybet data
    const existingSportyEventIds = new Set(eventsWithSportybet.map(event => event.eventId));
    
    // Find events that need to be updated or created
    const eventsToInsert = [];
    const eventsToUpdate = {};
    
    let premierLeagueCount = 0;
    
    for (const event of sportyData) {
      // Use both normalized and original ID for better matching
      const normalizedId = event.eventId && typeof event.eventId === 'string' ? 
                         event.eventId.replace(/\D/g, '') : event.eventId;
      const originalId = event.originalEventId || event.eventId;
      
      // Prepare the odds data
      const oddsData = {};
      
      if (event.odds) {
        oddsData['sporty'] = event.odds;
      } else if (event.home_odds !== undefined || event.draw_odds !== undefined || event.away_odds !== undefined) {
        const homeOdds = event.home_odds ? parseFloat(event.home_odds) : 0;
        const drawOdds = event.draw_odds ? parseFloat(event.draw_odds) : 0;
        const awayOdds = event.away_odds ? parseFloat(event.away_odds) : 0;
        
        if (homeOdds > 0 || drawOdds > 0 || awayOdds > 0) {
          oddsData['sporty'] = { home: homeOdds, draw: drawOdds, away: awayOdds };
        }
      }
      
      if (Object.keys(oddsData).length === 0) {
        continue; // Skip events with no odds
      }
      
      // Check if this event already exists in the database
      let existingEvent = allEvents.find(e => e.eventId === normalizedId || e.eventId === originalId);
      
      if (existingEvent) {
        // Only update if the event doesn't already have Sportybet data
        if (!existingSportyEventIds.has(existingEvent.eventId)) {
          // Update existing event with Sportybet odds
          const updatedOddsData = { ...existingEvent.oddsData, ...oddsData };
          
          // Check if this is a Premier League event (for existing events)
          const country = existingEvent.country || '';
          const tournament = existingEvent.tournament || '';
          if (country === 'England' && tournament === 'Premier League') {
            premierLeagueCount++;
            logger.info(`Found Premier League match to update: ${existingEvent.teams} (ID: ${existingEvent.id})`);
          }
          
          eventsToUpdate[existingEvent.id] = {
            oddsData: updatedOddsData,
            lastUpdated: new Date()
          };
        }
      } else {
        // Create a new event
        const teamsText = event.teams || event.event || (event.raw && event.raw.event) || 'Unknown';
        const country = event.country || (event.raw && event.raw.country) || '';
        const tournament = event.tournament || event.league || (event.raw && event.raw.tournament) || '';
        let league = `${country} ${tournament}`.trim();
        if (!league) {
          league = 'Unknown';
        }
        
        // Extract date and time
        let eventDate = '';
        let eventTime = '';
        
        if (event.date) {
          eventDate = event.date;
        } else if (event.raw && event.raw.start_time && event.raw.start_time.includes(' ')) {
          eventDate = event.raw.start_time.split(' ')[0];
        } else if (event.start_time && event.start_time.includes(' ')) {
          eventDate = event.start_time.split(' ')[0];
        } else {
          // Default date if not available
          const today = new Date();
          eventDate = today.toISOString().split('T')[0];
        }
        
        // Extract time
        if (event.time) {
          eventTime = event.time;
        } else if (event.raw && event.raw.start_time && event.raw.start_time.includes(' ')) {
          eventTime = event.raw.start_time.split(' ')[1];
        } else if (event.start_time && event.start_time.includes(' ')) {
          eventTime = event.start_time.split(' ')[1];
        } else {
          // Default time if not available
          eventTime = '12:00';
        }
        
        // Create a new event object
        eventsToInsert.push({
          eventId: normalizedId,
          externalId: originalId || normalizedId,
          teams: teamsText,
          league,
          country,
          tournament,
          sportId: 1, // Default to football
          date: eventDate,
          time: eventTime,
          oddsData,
          bestOdds: oddsData['sporty'], // Best odds are the only odds we have
          lastUpdated: new Date()
        });
        
        // Check if it's a Premier League event
        // More thorough check using multiple properties and case-insensitive matching
        const isEngland = country && country.toLowerCase() === 'england';
        const isPremierLeague = tournament && tournament.toLowerCase().includes('premier league') ||
                             league && league.toLowerCase().includes('england premier league');
        
        if (isEngland && isPremierLeague) {
          premierLeagueCount++;
          logger.info(`Found Premier League match: ${teamsText} (ID: ${normalizedId}) with odds ${JSON.stringify(oddsData.sporty)}`);
        }
      }
    }
    
    logger.critical(`Prepared ${eventsToInsert.length} events to insert and ${Object.keys(eventsToUpdate).length} events to update`);
    logger.critical(`Found ${premierLeagueCount} Premier League events in Sportybet data`);
    
    // Add detailed logging for every 200th event to help diagnose
    let sampleCount = 0;
    let directPremierLeagueCount = 0;
    
    // Direct check for Premier League events in raw data
    for (const event of sportyData) {
      if (sampleCount % 200 === 0) {
        const country = event.country || (event.raw && event.raw.country) || '';
        const tournament = event.tournament || event.league || (event.raw && event.raw.tournament) || '';
        const teams = event.teams || event.event || (event.raw && event.raw.event) || '';
        
        logger.critical(`Sample event ${sampleCount}: country="${country}", tournament="${tournament}", teams="${teams}"`);
      }
      
      // Check directly for Premier League events in source data
      const country = event.country || (event.raw && event.raw.country) || '';
      const tournament = event.tournament || event.league || (event.raw && event.raw.tournament) || '';
      
      if (country === 'England' && tournament === 'Premier League') {
        directPremierLeagueCount++;
        if (directPremierLeagueCount <= 10) {
          const teams = event.teams || event.event || (event.raw && event.raw.event) || '';
          logger.critical(`England Premier League Match Found: ${teams}`);
        }
      }
      
      sampleCount++;
    }
    
    logger.critical(`Direct Premier League check found ${directPremierLeagueCount} England Premier League events`)
    
    // Perform database operations
    let updateCount = 0;
    let insertCount = 0;
    
    // First update existing events
    if (Object.keys(eventsToUpdate).length > 0) {
      for (const [eventId, updateData] of Object.entries(eventsToUpdate)) {
        await storage.updateEvent(parseInt(eventId), updateData);
        updateCount++;
        
        // Log progress every 100 events
        if (updateCount % 100 === 0) {
          logger.critical(`Updated ${updateCount} / ${Object.keys(eventsToUpdate).length} events with Sportybet data`);
        }
      }
    }
    
    // Then insert new events
    if (eventsToInsert.length > 0) {
      for (const eventData of eventsToInsert) {
        await storage.createEvent(eventData);
        insertCount++;
        
        // Log progress every 100 events
        if (insertCount % 100 === 0) {
          logger.critical(`Inserted ${insertCount} / ${eventsToInsert.length} new events with Sportybet data`);
        }
      }
    }
    
    logger.critical(`Sportybet fix completed: ${insertCount} events inserted, ${updateCount} events updated`);
  } catch (error) {
    logger.critical(`Error in automatic Sportybet fix: ${error}`);
  }
}