import { IStorage } from '../storage';
import { insertEventSchema, type InsertEvent, events } from '@shared/schema';
import { db } from '../db';
import { eq, sql } from 'drizzle-orm';
import { saveOddsHistory } from './oddsHistory';
import { logger } from './logger';

// Console-based progress bar implementation
function drawProgressBar(percent: number, message: string) {
  const barLength = 30;
  const filledLength = Math.round(barLength * percent / 100);
  const emptyLength = barLength - filledLength;
  
  const filledBar = '█'.repeat(filledLength);
  const emptyBar = '░'.repeat(emptyLength);
  
  const percentText = percent.toFixed(1).padStart(5);
  
  logger.critical(`[${filledBar}${emptyBar}] ${percentText}% - ${message}`);
}

/**
 * Maps events from different bookmakers by matching exact eventIds
 * 
 * This is the core function that takes raw scraper data and:
 * 1. Identifies matching events across different bookmakers
 * 2. Updates existing events or creates new ones
 * 3. Calculates best odds and margins for each event
 */
export async function processAndMapEvents(storage: IStorage): Promise<void> {
  try {
    const startTime = new Date();
    logger.critical(`[${startTime.toISOString()}] Starting event mapping process`);
    
    // Get all bookmaker data
    const allBookmakerData = await storage.getAllBookmakersData();
    const bookmakerCodes = Object.keys(allBookmakerData);
    
    // Save a copy of the raw bookmaker data for inspection
    try {
      const fs = await import('fs/promises');
      await fs.writeFile('bookmaker_data.json', JSON.stringify(allBookmakerData, null, 2));
      logger.info(`Saved raw bookmaker data to bookmaker_data.json`);
    } catch (writeError) {
      logger.error(`Failed to save bookmaker data: ${writeError}`);
    }
    
    // Use maps to track events by their eventId (for exact matching across bookmakers)
    const eventMap = new Map<string, any>();
    const processedEvents = new Set<string>(); // Track which eventIds we've processed
    
    // Special handling for Sportybet to track its events for secondary matching
    const sportyEvents = [];
    if (allBookmakerData['sporty'] && Array.isArray(allBookmakerData['sporty'])) {
      sportyEvents.push(...allBookmakerData['sporty']);
    }
    
    // Create team name maps for all bookmakers for secondary matching
    const bookmakerTeamMaps = new Map<string, Map<string, any>>();
    
    // Initialize team maps for each bookmaker
    for (const bookmakerCode of bookmakerCodes) {
      bookmakerTeamMaps.set(bookmakerCode, new Map<string, any>());
    }
    
    // Removed event distribution tracking
    
    // Create map of team names to Sportybet events for secondary matching
    const sportyTeamsMap = new Map();
    sportyEvents.forEach(event => {
      if (event.teams) {
        const normalizedTeams = normalizeEventName(event.teams);
        sportyTeamsMap.set(normalizedTeams, event);
        
        // Also add reversed team order for better matching
        if (event.teams.includes(' vs ')) {
          const teams = event.teams.split(' vs ');
          if (teams.length === 2) {
            const reversedTeams = `${teams[1]} vs ${teams[0]}`;
            const reversedNormalizedTeams = normalizeEventName(reversedTeams);
            sportyTeamsMap.set(reversedNormalizedTeams, event);
          }
        }
      }
    });
    // Reduced log output
    
    // Also create maps for other bookmakers
    for (const bookmakerCode of bookmakerCodes) {
      if (bookmakerCode === 'sporty') continue; // Already handled above
      
      const bookmakerData = allBookmakerData[bookmakerCode];
      if (!bookmakerData || !Array.isArray(bookmakerData)) continue;
      
      const teamMap = bookmakerTeamMaps.get(bookmakerCode) || new Map();
      
      for (const event of bookmakerData) {
        if (event.teams) {
          const normalizedTeams = normalizeEventName(event.teams);
          teamMap.set(normalizedTeams, event);
          
          // Also add reversed team order for better matching
          if (event.teams.includes(' vs ')) {
            const teams = event.teams.split(' vs ');
            if (teams.length === 2) {
              const reversedTeams = `${teams[1]} vs ${teams[0]}`;
              const reversedNormalizedTeams = normalizeEventName(reversedTeams);
              teamMap.set(reversedNormalizedTeams, event);
            }
          }
        } else if (event.home && event.away) {
          // Create and normalize teams string if home/away are available directly
          const teams = `${event.home} vs ${event.away}`;
          const normalizedTeams = normalizeEventName(teams);
          teamMap.set(normalizedTeams, event);
          
          // Also add reversed team order
          const reversedTeams = `${event.away} vs ${event.home}`;
          const reversedNormalizedTeams = normalizeEventName(reversedTeams);
          teamMap.set(reversedNormalizedTeams, event);
        }
      }
      
      bookmakerTeamMaps.set(bookmakerCode, teamMap);
    }
    
    // Function to normalize eventId format - extracts numeric part from "sr:match:12345" format
    const normalizeEventId = (eventId: string): string => {
      // If it's in sr:match:12345 format, extract just the numeric part
      if (typeof eventId === 'string' && eventId.includes('sr:match:')) {
        return eventId.replace(/\D/g, '');
      }
      return eventId;
    };

    // First pass: collect all eventIds from all bookmakers
    const allEventIds = new Set<string>();
    // Track original to normalized ID mapping to handle lookups later
    const normalizedToOriginal = new Map<string, Set<string>>();
    
    for (const bookmakerCode of bookmakerCodes) {
      const bookmakerData = allBookmakerData[bookmakerCode];
      if (!bookmakerData || !Array.isArray(bookmakerData)) continue;
      
      for (const event of bookmakerData) {
        if (event.eventId) {
          // Store both original and normalized versions
          const normalizedId = normalizeEventId(event.eventId);
          allEventIds.add(normalizedId);
          
          // Track which original IDs map to this normalized ID
          if (!normalizedToOriginal.has(normalizedId)) {
            normalizedToOriginal.set(normalizedId, new Set());
          }
          normalizedToOriginal.get(normalizedId)?.add(event.eventId);
          
          // Enhanced debugging for Sportybet specifically
          if (bookmakerCode === 'sporty') {
            // Track all Sportybet events with their IDs and team names for debugging
            logger.info(`Sportybet event: ${event.event} | ID: ${event.eventId} → ${normalizedId}`);
          }
        }
      }
    }
    
    logger.critical(`Processing ${allEventIds.size} events...`);
    
    // Stats counters to track filtering results
    let eventsWith1Bookmaker = 0;
    let eventsWith2Bookmakers = 0; // Events with 2+ bookmakers will be included now
    let eventsWith3Bookmakers = 0;
    let eventsWith4Bookmakers = 0;
    let bookmakerEventsMapped = 0;
    
    // Count events per bookmaker
    const bookmakerEventCounts: Record<string, number> = {};
    bookmakerCodes.forEach(code => bookmakerEventCounts[code] = 0);
    
    // Second pass: Process each bookmaker's data and group by eventId
    for (const eventId of Array.from(allEventIds)) {
      let baseMatch = null;
      let firstMatch = null;
      const bookmakerOdds: Record<string, any> = {};
      let bookmakerCount = 0; // Counter to track how many bookmakers have odds for this event
      
      // First check if betPawa Ghana has this event - use it as our base for country/tournament
      const bpGhData = allBookmakerData['bp GH'];
      if (bpGhData && Array.isArray(bpGhData)) {
        baseMatch = bpGhData.find(e => e.eventId === eventId);
      }
      
      // Look for this eventId in all bookmakers
      for (const bookmakerCode of bookmakerCodes) {
        const bookmakerData = allBookmakerData[bookmakerCode];
        if (!bookmakerData || !Array.isArray(bookmakerData)) continue;
        
        // Find event with this ID in current bookmaker
        // For each bookmaker, check both direct match and normalized matches
        let event = null;
        
        // Removed bookmaker tracking code
        
        // First try direct match
        event = bookmakerData.find(e => e.eventId === eventId);
        
        // If not found, check if we need to normalize the event ID (especially for Sportybet)
        if (!event) {
          // Get all matching original IDs for this normalized ID
          const possibleOriginalIds = normalizedToOriginal.get(eventId);
          
          if (possibleOriginalIds && possibleOriginalIds.size > 0) {
            // Try each original format that maps to this normalized ID
            // Convert Set to Array for iteration to avoid TypeScript error
            Array.from(possibleOriginalIds).forEach(originalId => {
              if (event) return; // Skip if we already found a match
              
              const matchedEvent = bookmakerData.find(e => e.eventId === originalId);
              if (matchedEvent) {
                event = matchedEvent;
                if (bookmakerCode === 'sporty') {
                  logger.debug(`Matched Sportybet event using normalized ID: ${originalId} → ${eventId}`);
                }
              }
            });
          }
        }
        
        if (!event) continue;
        
        // Use first match as fallback event data if we don't have betPawa Ghana data
        if (!firstMatch) {
          firstMatch = event;
        }
        
        // Store odds from this bookmaker - handling different formats
        // Some scrapers use the odds field, others use home_odds, draw_odds, away_odds directly
        let hasOdds = false;
        
        if (event.odds) {
          bookmakerOdds[bookmakerCode] = event.odds;
          hasOdds = true;
        } else if (event.home_odds !== undefined || event.draw_odds !== undefined || event.away_odds !== undefined) {
          // Format for scrapers that provide odds directly - more permissive check
          // Convert to numeric and provide default of 0
          const homeOdds = event.home_odds ? parseFloat(event.home_odds) : 0;
          const drawOdds = event.draw_odds ? parseFloat(event.draw_odds) : 0;
          const awayOdds = event.away_odds ? parseFloat(event.away_odds) : 0;
          
          // Only consider valid if we have at least one non-zero odds
          if (homeOdds > 0 || drawOdds > 0 || awayOdds > 0) {
            bookmakerOdds[bookmakerCode] = {
              home: homeOdds,
              draw: drawOdds,
              away: awayOdds
            };
            hasOdds = true;
          }
        }
        
        // If this bookmaker has odds for this event, increment the counter
        if (hasOdds) {
          bookmakerCount++;
          bookmakerEventCounts[bookmakerCode] = (bookmakerEventCounts[bookmakerCode] || 0) + 1;
        }
      }
      
      // Track the number of bookmakers for each event
      if (bookmakerCount === 1) eventsWith1Bookmaker++;
      else if (bookmakerCount === 2) eventsWith2Bookmakers++;
      else if (bookmakerCount === 3) eventsWith3Bookmakers++;
      else if (bookmakerCount >= 4) eventsWith4Bookmakers++;

      // Only process events where at least 2 bookmakers have odds (changed from 3)
      if ((firstMatch || baseMatch) && bookmakerCount >= 2) {
        // Prioritize using betPawa Ghana data when available
        const dataSource = baseMatch || firstMatch;
        
        // Extract country and tournament, checking raw data first
        let country = '';
        let tournament = '';
        
        // First check if we have raw data from scrapers
        if (dataSource.raw && typeof dataSource.raw === 'object') {
          country = dataSource.raw.country || dataSource.country || '';
          tournament = dataSource.raw.tournament || dataSource.tournament || '';
        } else {
          country = dataSource.country || '';
          tournament = dataSource.tournament || '';
        }
        
        // For backward compatibility, also set league field
        let league = `${country} ${tournament}`.trim();
        if (!league) {
          league = dataSource.league || 'Unknown';
        }
        
        // Extract date from the data source
        let eventDate = '';
        let eventTime = '';
        
        // Handle date and time in different formats
        if (dataSource.date) {
          eventDate = dataSource.date;
        } else if (dataSource.raw && dataSource.raw.startDate) {
          eventDate = dataSource.raw.startDate;
        } else if (dataSource.startDate) {
          eventDate = dataSource.startDate;
        } else {
          // In case no date is available, use a default one week ahead
          const today = new Date();
          today.setDate(today.getDate() + 7);
          eventDate = today.toISOString().split('T')[0];
        }
        
        // Extract time
        if (dataSource.time) {
          eventTime = dataSource.time;
        } else if (dataSource.startTime) {
          eventTime = dataSource.startTime;
        } else if (dataSource.raw && dataSource.raw.startTime) {
          eventTime = dataSource.raw.startTime;
        } else {
          // Default time if not available
          eventTime = '12:00';
        }
        
        // Create or update the event in our map
        if (!eventMap.has(eventId)) {
          const teamsText = dataSource.teams || (dataSource.home && dataSource.away ? `${dataSource.home} vs ${dataSource.away}` : 'Unknown');
          
          // Create new event entry
          eventMap.set(eventId, {
            eventId: eventId,
            externalId: dataSource.externalId || eventId, // Use eventId as fallback
            teams: teamsText,
            league,
            country,
            tournament,
            sportId: getSportId(dataSource.sport || 'football'),
            date: eventDate,
            time: eventTime,
            oddsData: bookmakerOdds,
            bestOdds: { home: 0, draw: 0, away: 0 }
          });
          
          // Mark this eventId as processed
          processedEvents.add(eventId);
        } else {
          // Update existing event with additional bookmaker odds
          const eventData = eventMap.get(eventId);
          Object.assign(eventData.oddsData, bookmakerOdds);
        }
      }
    }
    
    // Process the collected events to calculate best odds
    for (const [eventId, eventData] of eventMap.entries()) {
      // Calculate best odds across all bookmakers
      const bestOdds = { home: 0, draw: 0, away: 0 };
      
      ['home', 'draw', 'away'].forEach(market => {
        let best = 0;
        
        for (const bookmakerCode of Object.keys(eventData.oddsData)) {
          const odds = eventData.oddsData[bookmakerCode];
          if (odds && odds[market] && odds[market] > best) {
            best = odds[market];
          }
        }
        
        if (best > 0) {
          bestOdds[market] = best;
        }
      });
      
      eventData.bestOdds = bestOdds;
    }
    
    // Removed additional bookmaker tracking logs
    
    // Third pass: Secondary matching for all bookmakers' events not yet mapped
    // This allows events with different eventIds but same team names to be matched
    logger.info(`Running secondary matching...`);
    
    // Track how many events were mapped in secondary matching
    const bookmakersMapped: Record<string, number> = {};
    bookmakerCodes.forEach(code => {
      bookmakersMapped[code] = 0;
    });
    
    // Process events in batches for better performance
    const eventEntries = Array.from(eventMap.entries());
    const batchSize = 200; // Process events in batches of 200
    const totalBatches = Math.ceil(eventEntries.length / batchSize);
    const totalEvents = eventEntries.length;

    // Flag to limit log output for performance
    let logsShown = 0;
    const MAX_LOGS = 0; // Disable logs completely for performance
    
    logger.critical(`Starting event mapping process - ${totalEvents} events to process`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min((batchIndex + 1) * batchSize, eventEntries.length);
      const batch = eventEntries.slice(batchStart, batchEnd);
      
      // Calculate progress percentage
      const progressPercent = ((batchIndex + 1) / totalBatches) * 100;
      
      // Only log every few batches to reduce output
      if (batchIndex % 2 === 0 || batchIndex === totalBatches - 1) {
        drawProgressBar(
          progressPercent, 
          `Processed ${batchEnd} / ${totalEvents} events (batch ${batchIndex+1}/${totalBatches})`
        );
      }
      
      // Process each event in current batch
      for (const [eventId, eventData] of batch) {
        // Try to match by team names if we have team data
        if (eventData.teams) {
          const normalizedTeams = normalizeEventName(eventData.teams);
          let reversedNormalizedTeams = null;
          
          // Prepare reversed teams format for matching both ways
          if (eventData.teams.includes(' vs ')) {
            const teams = eventData.teams.split(' vs ');
            if (teams.length === 2) {
              const reversedTeams = `${teams[1]} vs ${teams[0]}`;
              reversedNormalizedTeams = normalizeEventName(reversedTeams);
            }
          }
          
          // Try to match with each bookmaker
          for (const bookmakerCode of bookmakerCodes) {
            // Skip if this event already has odds for this bookmaker
            if (eventData.oddsData && eventData.oddsData[bookmakerCode]) {
              continue;
            }
            
            // Get the appropriate map based on bookmaker
            let bookieMap = null;
            if (bookmakerCode === 'sporty') {
              bookieMap = sportyTeamsMap;
            } else {
              bookieMap = bookmakerTeamMaps.get(bookmakerCode);
            }
            
            if (!bookieMap) continue;
            
            // Try to find a match with the normalized team name
            let bookieEvent = bookieMap.get(normalizedTeams);
            
            // If no match and we have reversed teams, try that
            if (!bookieEvent && reversedNormalizedTeams) {
              bookieEvent = bookieMap.get(reversedNormalizedTeams);
              
              if (bookieEvent && logsShown < MAX_LOGS) {
                logger.debug(`Matched ${bookmakerCode} event using reversed team names: ${eventData.teams}`);
                logsShown++;
              }
            }
            
            if (bookieEvent) {
              // We found a matching event by team name
              let hasOdds = false;
              let bookieOdds = null;
              
              if (bookieEvent.odds) {
                bookieOdds = bookieEvent.odds;
                hasOdds = true;
              } else if (bookieEvent.home_odds !== undefined || bookieEvent.draw_odds !== undefined || bookieEvent.away_odds !== undefined) {
                const homeOdds = bookieEvent.home_odds ? parseFloat(bookieEvent.home_odds) : 0;
                const drawOdds = bookieEvent.draw_odds ? parseFloat(bookieEvent.draw_odds) : 0;
                const awayOdds = bookieEvent.away_odds ? parseFloat(bookieEvent.away_odds) : 0;
                
                if (homeOdds > 0 || drawOdds > 0 || awayOdds > 0) {
                  bookieOdds = {
                    home: homeOdds,
                    draw: drawOdds,
                    away: awayOdds
                  };
                  hasOdds = true;
                }
              } else if (bookieEvent.homeOdds !== undefined || bookieEvent.drawOdds !== undefined || bookieEvent.awayOdds !== undefined) {
                // Additional format support for more scrapers
                const homeOdds = bookieEvent.homeOdds ? parseFloat(bookieEvent.homeOdds) : 0;
                const drawOdds = bookieEvent.drawOdds ? parseFloat(bookieEvent.drawOdds) : 0;
                const awayOdds = bookieEvent.awayOdds ? parseFloat(bookieEvent.awayOdds) : 0;
                
                if (homeOdds > 0 || drawOdds > 0 || awayOdds > 0) {
                  bookieOdds = {
                    home: homeOdds,
                    draw: drawOdds,
                    away: awayOdds
                  };
                  hasOdds = true;
                }
              }
              
              if (hasOdds) {
                // Add bookmaker odds to this event
                eventData.oddsData[bookmakerCode] = bookieOdds;
                
                // Recalculate best odds
                ['home', 'draw', 'away'].forEach(market => {
                  if (bookieOdds[market] && bookieOdds[market] > (eventData.bestOdds[market] || 0)) {
                    eventData.bestOdds[market] = bookieOdds[market];
                  }
                });
                
                // Track which bookmakers we've added
                // Handle type safety by checking if property exists first
                if (typeof bookmakersMapped[bookmakerCode] === 'number') {
                  bookmakersMapped[bookmakerCode] += 1;
                } else {
                  bookmakersMapped[bookmakerCode] = 1;
                }
                
                // Limit log output for better performance
                if (bookmakerCode === 'sporty' && logsShown < MAX_LOGS) {
                  logger.debug(`Secondary matched ${bookmakerCode} event for: ${eventData.teams}`);
                  logsShown++;
                }
              }
            }
          }
        }
      }
      
      // Log batch progress
      if ((batchIndex + 1) % 2 === 0 || batchIndex === totalBatches - 1) {
        logger.info(`Processed batch ${batchIndex + 1}/${totalBatches} (${Math.round((batchIndex + 1) / totalBatches * 100)}%)`);
      }
    }
    
    // Log summary of secondary matching
    logger.info(`Secondary matching success:`);
    for (const [bookmakerCode, count] of Object.entries(bookmakersMapped)) {
      if (count > 0) {
        logger.info(`  - Added ${count} events from ${bookmakerCode}`);
        bookmakerEventsMapped += count; // Update total count
      }
    }
    logger.critical(`Secondary matching added odds to ${bookmakerEventsMapped} total event-bookmaker combinations`);
    
    // Store or update events in database
    logger.critical(`Starting database updates - ${eventMap.size} events to process`);
    
    // Convert to array for progress tracking
    const eventsToUpdate = Array.from(eventMap.entries());
    const totalUpdateEvents = eventsToUpdate.length;
    let processedCount = 0;
    
    // Save the mapped events to a file for inspection
    try {
      const fs = await import('fs/promises');
      
      // Create a simplified version for easier analysis
      const simplifiedEvents = eventsToUpdate.map(([key, event]) => {
        return {
          eventId: event.eventId,
          teams: event.teams,
          country: event.country,
          tournament: event.tournament,
          date: event.date,
          time: event.time,
          bookmakers: Object.keys(event.oddsData || {}),
          oddsData: event.oddsData,
          bestOdds: event.bestOdds
        };
      });
      
      await fs.writeFile('mapped_events.json', JSON.stringify(simplifiedEvents, null, 2));
      logger.info(`Saved mapped events data to mapped_events.json`);
    } catch (writeError) {
      logger.error(`Failed to save mapped events data: ${writeError}`);
    }
    
    // Use larger batches for better performance
    const updateBatchSize = 200;
    const updateBatches = Math.ceil(totalUpdateEvents / updateBatchSize);
    
    // Prepare batch operations
    for (let i = 0; i < updateBatches; i++) {
      const batchStart = i * updateBatchSize;
      const batchEnd = Math.min((i + 1) * updateBatchSize, totalUpdateEvents);
      const currentBatch = eventsToUpdate.slice(batchStart, batchEnd);
      
      // Get all eventIds and externalIds for this batch
      const eventIds = currentBatch.map(([_, eventData]) => eventData.eventId);
      
      // Fetch all existing events in a single query using IN clause
      const existingEvents = await db.select()
        .from(events)
        .where(sql`event_id = ANY(ARRAY[${eventIds.map(id => `'${id}'`).join(',')}])`);
      
      // Create lookup maps
      const existingEventsByEventId = new Map(
        existingEvents.map(event => [event.eventId, event])
      );
      
      // Get any remaining events by externalId - one by one to avoid type issues
      for (const externalId of externalIds) {
        // Skip if we already found this event by eventId
        const event = await storage.getEventByExternalId(externalId);
        if (event) {
          existingEventsByExternalId.set(externalId, event);
        }
      }
      
      // Prepare batch operations
      const historyOperations = [];
      const createOperations = [];
      const updateOperations = [];
      
      // Process each event in the batch
      for (const [eventKey, eventData] of currentBatch) {
        try {
          // Check if event exists using the preloaded maps
          let existingEvent = existingEventsByEventId.get(eventData.eventId);
          
          // If not found by eventId, try by externalId
          if (!existingEvent) {
            existingEvent = existingEventsByExternalId.get(eventData.externalId);
          }
          
          processedCount++;
          
          // Show progress every 50 events or at the end
          if (processedCount % 50 === 0 || processedCount === totalUpdateEvents) {
            const progressPercent = (processedCount / totalUpdateEvents) * 100;
            drawProgressBar(
              progressPercent,
              `Database operations: ${processedCount} / ${totalUpdateEvents} events`
            );
          }
          
          // Collect odds history operations
          const newOdds = eventData.oddsData;
          for (const bookmakerCode of Object.keys(newOdds)) {
            const bookieOdds = newOdds[bookmakerCode];
            
            if (bookieOdds && (bookieOdds.home || bookieOdds.draw || bookieOdds.away)) {
              historyOperations.push({
                eventId: eventData.eventId,
                externalId: eventData.externalId,
                bookmakerCode,
                homeOdds: bookieOdds.home,
                drawOdds: bookieOdds.draw,
                awayOdds: bookieOdds.away
              });
            }
          }
          
          if (existingEvent) {
            // Queue update operation
            updateOperations.push({
              id: existingEvent.id,
              data: {
                oddsData: eventData.oddsData,
                bestOdds: eventData.bestOdds,
                teams: eventData.teams,
                league: eventData.league,
                country: eventData.country,
                tournament: eventData.tournament,
                date: eventData.date,
                time: eventData.time
              }
            });
          } else {
            // Queue create operation
            const insertData: InsertEvent = {
              externalId: eventData.externalId,
              eventId: eventData.eventId,
              teams: eventData.teams,
              league: eventData.league,
              country: eventData.country,
              tournament: eventData.tournament,
              sportId: eventData.sportId,
              date: eventData.date,
              time: eventData.time,
              oddsData: eventData.oddsData,
              bestOdds: eventData.bestOdds
            };
            
            // Validate event data
            const validatedData = insertEventSchema.parse(insertData);
            createOperations.push(validatedData);
          }
        } catch (error) {
          console.error(`Error processing event ${eventKey}:`, error);
        }
      }
      
      // Execute bulk operations
      try {
        // Bulk create new events
        if (createOperations.length > 0) {
          logger.info(`Bulk creating ${createOperations.length} new events in batch ${i+1}/${updateBatches}`);
          await db.insert(events).values(createOperations);
        }
        
        // Bulk update existing events
        if (updateOperations.length > 0) {
          logger.info(`Bulk updating ${updateOperations.length} existing events in batch ${i+1}/${updateBatches}`);
          // Group updates by fields to update for more efficient bulk operations
          const updates = updateOperations.map(op => ({
            where: eq(events.id, op.id),
            set: op.data
          }));
          await Promise.all(
            updates.map(({ where, set }) => db.update(events).set(set).where(where))
          );
        }
        
        // Save odds history in batches of 50
        const historyBatchSize = 50;
        const historyBatches = Math.ceil(historyOperations.length / historyBatchSize);
        
        for (let j = 0; j < historyBatches; j++) {
          const historyBatchStart = j * historyBatchSize;
          const historyBatchEnd = Math.min((j + 1) * historyBatchSize, historyOperations.length);
          const historyBatch = historyOperations.slice(historyBatchStart, historyBatchEnd);
          
          await Promise.all(historyBatch.map(op => 
            saveOddsHistory(
              op.eventId,
              op.externalId,
              op.bookmakerCode,
              op.homeOdds,
              op.drawOdds, 
              op.awayOdds
            )
          ));
        }
        
        logger.info(`Completed batch ${i+1}/${updateBatches} of database operations`);
      } catch (batchError) {
        logger.error(`Error executing batch ${i+1}/${updateBatches}:`, batchError);
      }
    }
    
    // Removed bookmaker count code
    
    // Removed event distribution logs to reduce console output
    
    // Bookmaker combination logging removed to reduce console output
    
    // Summary log removed to prevent frequent repeated messages
    
    // Get all events and delete any that don't meet our criteria anymore
    // This ensures events that previously had 3+ bookmakers but now have fewer are removed
    const allEvents = await storage.getEvents();
    const currentEventIds = new Set(Array.from(eventMap.keys()));
    
    let deletedCount = 0;
    
    logger.info(`Cleaning up events that no longer meet criteria...`);
    
    // Remove events that don't meet criteria anymore
    for (const event of allEvents) {
      // If this event is not in our current map and has an eventId, it should be removed
      if (event.eventId && !currentEventIds.has(event.eventId)) {
        try {
          // Skip logs for individual event removal to reduce console noise
          // console.log(`Event ${event.id} (${event.eventId}: ${event.teams}) no longer meets criteria - removing from database`);
          // Delete the event from the database
          await db.delete(events).where(eq(events.id, event.id));
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting event ${event.id}:`, error);
        }
      }
    }
    
    // Log summary of cleanup with timestamp
    const endTime = new Date();
    
    // Create bookmaker counts summary
    let bookmakerSummary = "";
    for (const [code, count] of Object.entries(bookmakerEventCounts)) {
      bookmakerSummary += `${code}: ${count} events, `;
    }
    
    // Remove trailing comma and space
    if (bookmakerSummary.endsWith(", ")) {
      bookmakerSummary = bookmakerSummary.slice(0, -2);
    }
    
    logger.critical(`[${endTime.toISOString()}] Event mapping finished - ${currentEventIds.size} events mapped, ${deletedCount} events removed, final count: ${allEvents.length - deletedCount}`);
    logger.critical(`[${endTime.toISOString()}] Events per bookmaker: ${bookmakerSummary}`);
    
  } catch (error) {
    logger.critical('Error processing and mapping events:', error);
    throw error;
  }

  // Calculate and store tournament margins
  try {
    const { calculateAndStoreTournamentMargins } = await import('./tournamentMargins');
    await calculateAndStoreTournamentMargins(storage);
  } catch (marginError) {
    logger.critical('Error calculating tournament margins:', marginError);
    // Don't throw this error, as it shouldn't stop the main process
  }
}

/**
 * Normalize event name for matching across bookmakers
 * This function is specifically optimized to make team name matching more reliable
 */
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

/**
 * Get sport ID based on sport name
 * In a real implementation, this would look up the ID from the database
 */
function getSportId(sportName: string): number {
  const sportMap: Record<string, number> = {
    'football': 1,
    'basketball': 2,
    'tennis': 3,
    'horseracing': 4
  };
  
  return sportMap[sportName.toLowerCase()] || 1; // Default to football
}