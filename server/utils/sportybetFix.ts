import { IStorage } from '../storage';
import { logger } from './logger';

// NOTE: This file is maintained as a safety net but is no longer actively used
// since we've switched to the Python Sportybet scraper which doesn't have the
// JavaScript memory reference issues. We keep it as a fallback only.
/**
 * Helper function to get Premier League events data.
 * This is used for diagnostics and debugging.
 */
export async function getPremierLeagueData(storage: IStorage): Promise<any> {
  // Get fresh Sportybet data with forceFresh=true to avoid any cached data
  const rawSportyData = await storage.getBookmakerData('sporty', true);
  
  // CRITICAL: Create a deep copy to prevent modification of the original data
  // This is crucial to prevent events from disappearing between requests
  const sportyData = JSON.parse(JSON.stringify(rawSportyData));
  
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
    // Get Sportybet data from file with force fresh to avoid any cached data
    const rawSportyData = await storage.getBookmakerData('sporty', true);
    if (!Array.isArray(rawSportyData) || rawSportyData.length === 0) {
      logger.critical(`No Sportybet data found in file during automatic fix`);
      return;
    }
    
    // CRITICAL: Create a deep copy of the data to prevent modification of the original
    // This is essential to prevent events from disappearing between requests
    const sportyData = JSON.parse(JSON.stringify(rawSportyData));
    
    logger.critical(`Raw Sportybet data check: ${sportyData.length} events found in file`);
    
    // Get existing events from the database
    const rawAllEvents = await storage.getEvents();
    
    // CRITICAL: Deep copy events to prevent reference modifications
    const allEvents = JSON.parse(JSON.stringify(rawAllEvents));
    
    const eventsWithSportybet = allEvents.filter(event => 
      event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData
    );
    
    // Check for any discrepancy between Sportybet raw data and database
    const discrepancyRatio = eventsWithSportybet.length / sportyData.length;
    
    if (discrepancyRatio < 0.99) {
      logger.critical(`ALERT: Sportybet data loss detected! Database has ${eventsWithSportybet.length}/${sportyData.length} events (${(discrepancyRatio * 100).toFixed(1)}%). Using enhanced recovery mode.`);
    }
    
    // Create a map of events by eventId and externalId for faster lookups
    const eventsByEventId = new Map();
    const eventsByExternalId = new Map();
    
    // Also create a map by normalized team names for aggressive matching
    const eventsByNormalizedTeams = new Map();
    
    allEvents.forEach(event => {
      if (event.eventId) {
        eventsByEventId.set(event.eventId, event);
      }
      if (event.externalId) {
        eventsByExternalId.set(event.externalId, event);
      }
      
      // Add to team name map for aggressive matching
      if (event.teams) {
        const normalizedTeams = normalizeEventName(event.teams);
        eventsByNormalizedTeams.set(normalizedTeams, event);
      }
    });
    
    logger.critical(`Forcing Sportybet processing to ensure all data is present...`);
    
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
      } else if (event.raw) {
        // Try to extract from raw data if available
        const homeOdds = event.raw.home_odds ? parseFloat(event.raw.home_odds) : 0;
        const drawOdds = event.raw.draw_odds ? parseFloat(event.raw.draw_odds) : 0;
        const awayOdds = event.raw.away_odds ? parseFloat(event.raw.away_odds) : 0;
        
        if (homeOdds > 0 || drawOdds > 0 || awayOdds > 0) {
          oddsData['sporty'] = { home: homeOdds, draw: drawOdds, away: awayOdds };
        }
      }
      
      if (Object.keys(oddsData).length === 0) {
        continue; // Skip events with no odds
      }
      
      // Check if this event already exists in the database using the maps for faster lookup
      let existingEvent = eventsByEventId.get(normalizedId) || 
                           eventsByEventId.get(originalId) || 
                           eventsByExternalId.get(normalizedId) || 
                           eventsByExternalId.get(originalId);
      
      if (existingEvent) {
        // Check if this is a Premier League event
        const isPremierLeague = (existingEvent.country === 'England' && existingEvent.tournament === 'Premier League');
        
        // Always update existing events to maintain Sportybet odds data
        // This is key to preventing disappearing odds
        const updatedOddsData = { 
          ...existingEvent.oddsData, 
          sporty: oddsData['sporty'] // Ensure Sportybet odds are updated/preserved
        };
        
        // Track Premier League events
        if (isPremierLeague) {
          premierLeagueCount++;
          logger.info(`Found Premier League match to update: ${existingEvent.teams} (ID: ${existingEvent.id})`);
        }
        
        eventsToUpdate[existingEvent.id] = {
          oddsData: updatedOddsData,
          lastUpdated: new Date()
        };
      } else {
        // Extra check for existing events by teams/date/time to avoid creating duplicates
        // This helps prevent unique constraint errors on external_id
        const teamsText = event.teams || event.event || (event.raw && event.raw.event) || 'Unknown';
        const eventDate = extractDate(event);
        
        // Try more aggressive team name matching if we have a significant discrepancy
        if (discrepancyRatio < 0.7) {
          // Check for matches by normalized team names
          const normalizedTeams = normalizeEventName(teamsText);
          const normalizedMatch = eventsByNormalizedTeams.get(normalizedTeams);
          
          if (normalizedMatch) {
            // Update using normalized match
            const updatedOddsData = { 
              ...normalizedMatch.oddsData, 
              sporty: oddsData['sporty']
            };
            
            eventsToUpdate[normalizedMatch.id] = {
              oddsData: updatedOddsData,
              lastUpdated: new Date()
            };
            
            logger.info(`Found match by normalized team name: ${teamsText} (normalized to: ${normalizedTeams})`);
            continue;
          }
        }
        
        // Look for a potential match by team names and date to avoid duplicates
        const potentialMatch = allEvents.find(e => 
          e.teams === teamsText && 
          e.date === eventDate
        );
        
        if (potentialMatch) {
          // Update the potential match instead of creating a new event
          const updatedOddsData = { 
            ...potentialMatch.oddsData, 
            sporty: oddsData['sporty']
          };
          
          eventsToUpdate[potentialMatch.id] = {
            oddsData: updatedOddsData,
            lastUpdated: new Date()
          };
          
          logger.info(`Found match by team name and date: ${teamsText} (${eventDate})`);
          continue;
        }
        
        // Create a new event object
        const country = event.country || (event.raw && event.raw.country) || '';
        const tournament = event.tournament || event.league || (event.raw && event.raw.tournament) || '';
        let league = `${country} ${tournament}`.trim();
        if (!league) {
          league = 'Unknown';
        }
        
        // Create a new event object
        const newEventData = {
          eventId: normalizedId,
          externalId: originalId || normalizedId,
          teams: teamsText,
          league,
          country,
          tournament,
          sportId: 1, // Default to football
          date: eventDate,
          time: extractTime(event),
          oddsData,
          bestOdds: oddsData['sporty'], // Best odds are the only odds we have
          lastUpdated: new Date()
        };
        
        // Try to check if this event already exists by externalId before adding to insert list
        try {
          const existingByExternalId = await storage.getEventByExternalId(newEventData.externalId);
          if (existingByExternalId) {
            // If it exists, update instead of inserting
            const updatedOddsData = {
              ...existingByExternalId.oddsData,
              sporty: oddsData['sporty']
            };
            
            eventsToUpdate[existingByExternalId.id] = {
              oddsData: updatedOddsData,
              lastUpdated: new Date()
            };
            logger.info(`Found existing event by externalId: ${newEventData.externalId}`);
          } else {
            // If not found by externalId, try by eventId
            const existingByEventId = await storage.getEventByEventId(newEventData.eventId);
            if (existingByEventId) {
              // If it exists, update instead of inserting
              const updatedOddsData = {
                ...existingByEventId.oddsData,
                sporty: oddsData['sporty']
              };
              
              eventsToUpdate[existingByEventId.id] = {
                oddsData: updatedOddsData,
                lastUpdated: new Date()
              };
              logger.info(`Found existing event by eventId: ${newEventData.eventId}`);
            } else {
              // Only add to insert list if truly not found in the database
              eventsToInsert.push(newEventData);
            }
          }
        } catch (e) {
          logger.critical(`Error checking for existing event: ${e.message}`);
          // Add to insert list with caution
          eventsToInsert.push(newEventData);
        }
        
        // Check if it's a Premier League event
        const isEngland = country && country.toLowerCase() === 'england';
        const isPremierLeague = tournament && tournament.toLowerCase().includes('premier league') ||
                             league && league.toLowerCase().includes('england premier league');
        
        if (isEngland && isPremierLeague) {
          premierLeagueCount++;
          logger.info(`Found Premier League match: ${teamsText} (ID: ${normalizedId})`);
        }
      }
    }
    
    logger.critical(`Prepared ${eventsToInsert.length} events to insert and ${Object.keys(eventsToUpdate).length} events to update`);
    logger.critical(`Found ${premierLeagueCount} Premier League events in Sportybet data`);
    
    // Add detailed logging for Premier League events
    let directPremierLeagueCount = 0;
    
    // Direct check for Premier League events in raw data
    for (const event of sportyData) {
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
    }
    
    logger.critical(`Direct Premier League check found ${directPremierLeagueCount} England Premier League events`)
    
    // Perform database operations
    let updateCount = 0;
    let insertCount = 0;
    let errorCount = 0;
    
    // First update existing events
    if (Object.keys(eventsToUpdate).length > 0) {
      for (const [eventId, updateData] of Object.entries(eventsToUpdate)) {
        try {
          await storage.updateEvent(parseInt(eventId), updateData);
          updateCount++;
          
          // Log progress every 100 events
          if (updateCount % 100 === 0) {
            logger.critical(`Updated ${updateCount} / ${Object.keys(eventsToUpdate).length} events with Sportybet data`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`Error updating event ${eventId}: ${error.message}`);
        }
      }
    }
    
    // Then insert new events using a safer approach
    if (eventsToInsert.length > 0) {
      for (const eventData of eventsToInsert) {
        try {
          // Double-check one more time that this event doesn't exist
          const existingByExternalId = await storage.getEventByExternalId(eventData.externalId);
          const existingByEventId = await storage.getEventByEventId(eventData.eventId);
          
          if (existingByExternalId) {
            // If it exists, update instead of inserting
            const updatedOddsData = {
              ...existingByExternalId.oddsData,
              sporty: eventData.oddsData.sporty
            };
            
            await storage.updateEvent(existingByExternalId.id, {
              oddsData: updatedOddsData,
              lastUpdated: new Date()
            });
            updateCount++;
          } else if (existingByEventId) {
            // If it exists by eventId, update instead of inserting
            const updatedOddsData = {
              ...existingByEventId.oddsData,
              sporty: eventData.oddsData.sporty
            };
            
            await storage.updateEvent(existingByEventId.id, {
              oddsData: updatedOddsData,
              lastUpdated: new Date()
            });
            updateCount++;
          } else {
            // If truly not found, insert safely
            await storage.createEvent(eventData);
            insertCount++;
          }
          
          // Log progress every 100 events
          if ((insertCount + updateCount) % 100 === 0) {
            logger.critical(`Processed ${insertCount + updateCount} / ${eventsToInsert.length} new events with Sportybet data`);
          }
        } catch (error) {
          errorCount++;
          logger.error(`Error inserting event ${eventData.teams} (${eventData.externalId}): ${error.message}`);
          
          // Try to update instead if it's a duplicate key error
          if (error.message.includes('duplicate key')) {
            try {
              // Try to find the event by team name and date as a last resort
              const matchingEvents = allEvents.filter(e => 
                e.teams === eventData.teams && 
                e.date === eventData.date
              );
              
              if (matchingEvents.length > 0) {
                const matchEvent = matchingEvents[0];
                const updatedOddsData = {
                  ...matchEvent.oddsData,
                  sporty: eventData.oddsData.sporty
                };
                
                await storage.updateEvent(matchEvent.id, {
                  oddsData: updatedOddsData,
                  lastUpdated: new Date()
                });
                
                logger.info(`Recovered from duplicate key error by updating event by name: ${eventData.teams}`);
                updateCount++;
              }
            } catch (recoveryError) {
              logger.error(`Failed to recover from duplicate key error: ${recoveryError.message}`);
            }
          }
        }
      }
    }
    
    logger.critical(`Sportybet fix completed: ${insertCount} events inserted, ${updateCount} events updated, ${errorCount} errors handled`);
  } catch (error) {
    logger.critical(`Error in automatic Sportybet fix: ${error}`);
  }
}

// Helper function to extract date from event
function extractDate(event: any): string {
  if (event.date) {
    return event.date;
  } else if (event.raw && event.raw.start_time && event.raw.start_time.includes(' ')) {
    return event.raw.start_time.split(' ')[0];
  } else if (event.start_time && event.start_time.includes(' ')) {
    return event.start_time.split(' ')[0];
  } else {
    // Default date if not available
    const today = new Date();
    return today.toISOString().split('T')[0];
  }
}

// Helper function to extract time from event
function extractTime(event: any): string {
  if (event.time) {
    return event.time;
  } else if (event.raw && event.raw.start_time && event.raw.start_time.includes(' ')) {
    return event.raw.start_time.split(' ')[1];
  } else if (event.start_time && event.start_time.includes(' ')) {
    return event.start_time.split(' ')[1];
  } else {
    // Default time if not available
    return '12:00';
  }
}

// Helper function to normalize team names
function normalizeEventName(eventName: string): string {
  if (!eventName) return '';

  let normalized = eventName
    .toLowerCase()
    // Standardize separator to 'vs' for consistent processing
    .replace(/\s+v\.?\s+|\s+-\s+|\s+@\s+/g, ' vs ')
    // Standardize quotes and parentheses
    .replace(/['"''""()[\]{}]/g, '')
    // Remove 'fc' (football club)
    .replace(/\s+fc\b|\bfc\s+|\s+football\s+club|\bfootball\s+club/g, '')
    // Specific frequent misspellings and variations
    .replace(/juventus turin/g, 'juventus')
    .replace(/inter milan/g, 'internazionale')
    .replace(/rb leipzig/g, 'leipzig')
    .replace(/psg/g, 'paris')
    .replace(/wolves/g, 'wolverhampton')
    .replace(/spurs/g, 'tottenham')
    .replace(/napoli sc/g, 'napoli')
    .replace(/ac milan/g, 'milan')
    // Remove common suffixes - expanded list (but only after we standardize separators)
    .replace(/\s+(united|utd|city|town|county|albion|rovers|wanderers|athletic|hotspur|wednesday|forest|fc|academy|reserve|women|ladies|boys|girls|u\d+|under\d+|fc\.?)\b/g, '')
    // Remove common location prefixes
    .replace(/\b(west|east|north|south|central|real|atletico|deportivo|inter|lokomotiv|dynamo)\s+/g, '')
    // Remove country specifiers
    .replace(/\s+(ghana|kenya|uganda|tanzania|nigeria|zambia)\b/g, '')
    // Replacements for specific abbreviations
    .replace(/\bmanu\b/g, 'manchester') // Manchester United 
    .replace(/\bman\s+u\b/g, 'manchester') // Manchester United
    .replace(/\bman\s+utd\b/g, 'manchester') // Manchester United
    .replace(/\bman\s+city\b/g, 'manchester') // Manchester City
    .replace(/\bman\s+c\b/g, 'manchester') // Manchester City
    .replace(/\blfc\b/g, 'liverpool') // Liverpool FC
    .replace(/\bafc\b/g, 'arsenal') // Arsenal FC
    .replace(/\bcfc\b/g, 'chelsea') // Chelsea FC
    .replace(/\bbvb\b/g, 'dortmund') // Borussia Dortmund
    .replace(/\bfcb\b/g, 'bayern') // Bayern Munich
    // Replace ampersands with 'and'
    .replace(/&/g, 'and');

  // Now transform both team names separately if we have a vs separator
  if (normalized.includes(' vs ')) {
    const parts = normalized.split(' vs ');
    if (parts.length === 2) {
      // Normalize each team name separately
      const [team1, team2] = parts;
      const normalizedTeam1 = team1
        .replace(/\./g, '') // Remove periods
        .replace(/\s+/g, '') // Remove all whitespace
        .replace(/[^\w]/g, '') // Remove any remaining punctuation
        .trim();

      const normalizedTeam2 = team2
        .replace(/\./g, '')
        .replace(/\s+/g, '')
        .replace(/[^\w]/g, '')
        .trim();

      return `${normalizedTeam1} vs ${normalizedTeam2}`;
    }
  }

  // If no 'vs' or format not as expected, just clean up the whole string
  return normalized
    .replace(/\./g, '') // Remove periods
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/[^\w]/g, '') // Remove any remaining punctuation
    .trim();
}