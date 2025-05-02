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

    // Get all bookmaker data - force fresh load to avoid caching issues
    logger.critical('Loading fresh bookmaker data from disk...');
    const rawBookmakerData = await storage.getAllBookmakersData(true);
    
    // Create a deep copy to prevent accidental modifications of the source data
    // This is critical to prevent events from disappearing between requests
    const allBookmakerData = JSON.parse(JSON.stringify(rawBookmakerData));
    const bookmakerCodes = Object.keys(allBookmakerData);
    
    // Log detailed bookmaker data
    for (const [code, data] of Object.entries(allBookmakerData)) {
      const count = Array.isArray(data) ? data.length : 0;
      logger.critical(`Bookmaker ${code}: loaded ${count} events`);
      
      // Special log for Sportybet
      if (code === 'sporty' && count > 0 && Array.isArray(data)) {
        logger.critical(`First Sportybet event: ${JSON.stringify(data[0])}`);
      }
    }

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
    
    // Special tracking for England Premier League events
    const eplEvents = {
      byEventId: new Map<string, {
        teams: string,
        date: string,
        time: string,
        bookmakers: Set<string>,
        hasSportybet: boolean
      }>(),
      total: 0,
      withSportybet: 0
    };
    const teamNameToEventIds = new Map<string, Array<{eventId: string, originalEventId?: string, bookmakerCode: string}>>();

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

          // Enhanced debugging and tracking for Sportybet specifically
          if (bookmakerCode === 'sporty') {
            // Track all Sportybet events with their IDs and team names for debugging
            const originalId = event.originalEventId || event.eventId;
            logger.info(`Sportybet event: ${event.event} | ID: ${originalId} → ${normalizedId}`);
            
            // Store both the original event ID and the normalized ID for better matching
            if (!normalizedToOriginal.has(normalizedId)) {
              normalizedToOriginal.set(normalizedId, new Set());
            }
            
            // Add both IDs to help with matching
            if (event.originalEventId) {
              normalizedToOriginal.get(normalizedId)?.add(event.originalEventId);
            }
            
            // Enhanced team name tracking for Sportybet
            // This would help with more complex matching in the future
            if (event.event) {
              const normalizedTeams = normalizeEventName(event.event);
              // Commented out for now to avoid reference issues
              // Will implement in a future update
            }
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
      
      // Check if this event has Sportybet odds
      let hasSportybetOdds = false;
      let isSportybetOnly = false;
      
      for (const bookmakerCode of bookmakerCodes) {
        if (bookmakerCode === 'sporty' && bookmakerOdds[bookmakerCode]) {
          hasSportybetOdds = true;
          
          // Check if this is a Sportybet-only event
          if (bookmakerCount === 1) {
            isSportybetOnly = true;
          }
          break;
        }
      }

      // Function to check if an event is an upcoming Premier League match
      const isValidPremierLeagueMatch = (dataSource: any): boolean => {
        // Check if it's Premier League
        const isPremierLeague = 
          (dataSource.tournament?.toLowerCase().includes('premier league') && 
           dataSource.country?.toLowerCase().includes('england')) ||
          (dataSource.raw?.tournament?.toLowerCase().includes('premier league') && 
           dataSource.raw?.country?.toLowerCase().includes('england'));
        
        if (!isPremierLeague) return false;
        
        // Extract date from data source
        let eventDate = '';
        if (dataSource.date) {
          eventDate = dataSource.date;
        } else if (dataSource.raw && dataSource.raw.startDate) {
          eventDate = dataSource.raw.startDate;
        } else if (dataSource.startDate) {
          eventDate = dataSource.startDate;
        }
        
        // No date validation
        if (!eventDate) return false;
        
        // Convert to Date object
        const match_date = new Date(eventDate);
        const now = new Date();
        
        // Check if date is in valid range (today up to 30 days in future)
        // This prevents matches with incorrect dates from being included
        const diffDays = Math.floor((match_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
      };

      // Apply special validation for Sportybet-only events that are Premier League matches
      const isValidSportybetPremierLeagueMatch = isSportybetOnly && 
        ((firstMatch && isValidPremierLeagueMatch(firstMatch)) || 
         (baseMatch && isValidPremierLeagueMatch(baseMatch)));
         
      // Log Sportybet Premier League matches for debugging
      if (isSportybetOnly && 
         ((firstMatch && firstMatch.tournament?.toLowerCase().includes('premier league') && firstMatch.country?.toLowerCase().includes('england')) || 
          (baseMatch && baseMatch.tournament?.toLowerCase().includes('premier league') && baseMatch.country?.toLowerCase().includes('england')))) {
          
        // Get data source
        const dataSource = baseMatch || firstMatch;
        
        // Extract date
        let eventDate = '';
        if (dataSource.date) {
          eventDate = dataSource.date;
        } else if (dataSource.raw && dataSource.raw.startDate) {
          eventDate = dataSource.raw.startDate;
        } else if (dataSource.startDate) {
          eventDate = dataSource.startDate;
        }
        
        // Extract teams
        const teamsText = dataSource.teams || 
          (dataSource.home && dataSource.away ? `${dataSource.home} vs ${dataSource.away}` : 'Unknown');
          
        // Log this Sportybet Premier League match for debugging
        logger.info(`Sportybet-only Premier League match: ${teamsText} | Date: ${eventDate} | Valid: ${isValidSportybetPremierLeagueMatch}`);
      }

      // Only process events where:
      // 1. At least 3 bookmakers have odds, OR
      // 2. The event has Sportybet odds (to preserve all Sportybet events)
      //    AND passes date validation for Premier League matches
      if ((firstMatch || baseMatch) && (bookmakerCount >= 3 || 
          (hasSportybetOdds && (!isSportybetOnly || isValidSportybetPremierLeagueMatch)))) {
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

    // First fetch ALL events in one query to avoid repeated database lookups
    logger.critical('Fetching all existing events to optimize database operations...');
    
    // Collect all eventIds and externalIds from the eventsToUpdate array
    const eventIdsForLookup = eventsToUpdate.map(([_, e]) => e.eventId);
    const externalIdsForLookup = eventsToUpdate
      .map(([_, e]) => e.externalId)
      .filter(Boolean);
    
    // Fetch events by eventId in a single query
    logger.info(`Pre-fetching ${eventIdsForLookup.length} events by eventId...`);
    const existingEvents = await db.select()
      .from(events)
      .where(sql`event_id = ANY(ARRAY[${eventIdsForLookup.map(id => `'${id}'`).join(',')}])`);
    
    // Create lookup map for eventId
    const existingEventsByEventId = new Map(
      existingEvents.map(event => [event.eventId, event])
    );
    
    // Fetch events by externalId in a single query
    logger.info(`Pre-fetching ${externalIdsForLookup.length} events by externalId...`);
    const existingEventsByExternalId = new Map();
    
    // Only query if we have externalIds
    if (externalIdsForLookup.length > 0) {
      const externalIdEvents = await db.select()
        .from(events)
        .where(sql`external_id = ANY(ARRAY[${externalIdsForLookup.map(id => `'${id}'`).join(',')}])`);
        
      externalIdEvents.forEach(event => {
        if (event.externalId) {
          existingEventsByExternalId.set(event.externalId, event);
        }
      });
    }
    
    logger.critical(`Pre-fetched ${existingEvents.length} existing events by eventId and ${existingEventsByExternalId.size} events by externalId`);
    
    // Increased batch size for better throughput
    const updateBatchSize = 300;
    const updateBatches = Math.ceil(totalUpdateEvents / updateBatchSize);

    // Prepare batch operations
    for (let i = 0; i < updateBatches; i++) {
      const batchStart = i * updateBatchSize;
      const batchEnd = Math.min((i + 1) * updateBatchSize, totalUpdateEvents);
      const currentBatch = eventsToUpdate.slice(batchStart, batchEnd);

      // Prepare batch operations
      const historyOperations = [];
      const createOperations = [];
      const updateOperations = [];

      try {
        // Process each event in the batch
        for (const [eventKey, eventData] of currentBatch) {
          try {
            // Check if event exists using the preloaded maps
            let existingEvent = existingEventsByEventId.get(eventData.eventId);

            // If not found by eventId, try by externalId
            if (!existingEvent && eventData.externalId) {
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
        // Bulk create new events with conflict handling on external_id
        if (createOperations.length > 0) {
          logger.info(`Bulk creating ${createOperations.length} new events in batch ${i+1}/${updateBatches}`);
          try {
            // Use onConflictDoUpdate to handle duplicate external_id values
            await db.insert(events).values(createOperations)
              .onConflictDoUpdate({
                target: events.externalId,
                set: {
                  eventId: sql`excluded.event_id`,
                  teams: sql`excluded.teams`,
                  league: sql`excluded.league`,
                  country: sql`excluded.country`,
                  tournament: sql`excluded.tournament`,
                  sportId: sql`excluded.sport_id`,
                  date: sql`excluded.date`,
                  time: sql`excluded.time`,
                  oddsData: sql`excluded.odds_data`,
                  bestOdds: sql`excluded.best_odds`,
                  lastUpdated: sql`CURRENT_TIMESTAMP`
                }
              });
          } catch (insertError) {
            logger.error(`Error with bulk insert operation: ${insertError.message}`);
            
            // Fall back to individual inserts if the bulk operation fails
            let successCount = 0;
            for (const event of createOperations) {
              try {
                await db.insert(events).values(event)
                  .onConflictDoUpdate({
                    target: events.externalId,
                    set: {
                      eventId: event.eventId,
                      teams: event.teams,
                      league: event.league,
                      country: event.country || null,
                      tournament: event.tournament || null,
                      sportId: event.sportId,
                      date: event.date,
                      time: event.time,
                      oddsData: event.oddsData,
                      bestOdds: event.bestOdds,
                      lastUpdated: new Date()
                    }
                  });
                successCount++;
              } catch (err) {
                logger.info(`Error inserting event ${event.externalId}: ${err.message}`);
              }
            }
            logger.info(`Inserted ${successCount}/${createOperations.length} events individually after bulk failure`);
          }
        }

        // Bulk update existing events - using chunked approach for better performance
        if (updateOperations.length > 0) {
          // Process updates in smaller chunks to avoid overwhelming the database
          const updateChunkSize = 50;
          const updateChunks = Math.ceil(updateOperations.length / updateChunkSize);
          
          logger.info(`Bulk updating ${updateOperations.length} existing events in ${updateChunks} chunks (batch ${i+1}/${updateBatches})`);
          
          for (let c = 0; c < updateChunks; c++) {
            const chunkStart = c * updateChunkSize;
            const chunkEnd = Math.min((c + 1) * updateChunkSize, updateOperations.length);
            const currentChunk = updateOperations.slice(chunkStart, chunkEnd);
            
            // Group updates by fields to update for more efficient bulk operations
            const updates = currentChunk.map(op => ({
              where: eq(events.id, op.id),
              set: {
                ...op.data,
                lastUpdated: new Date() // Always update the timestamp
              }
            }));
            
            try {
              // Process chunk of updates in parallel
              await Promise.all(
                updates.map(({ where, set }) => db.update(events).set(set).where(where))
              );
              logger.info(`Completed update chunk ${c+1}/${updateChunks}`);
            } catch (updateError) {
              logger.error(`Error updating chunk ${c+1}/${updateChunks}: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
            }
          }
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

    // Get all events and delete any that don't meet our criteria anymore
    // This ensures events that previously had 2+ bookmakers but now have fewer are removed
    // EXCEPTION: We keep all events with Sportybet odds to prevent decreasing Sportybet event counts
    // Also, we directly inject Sportybet events into the eventMap as a special case
    // This ensures maximum retention of Sportybet events during mapping
    
    // First get all Sportybet events from the raw data
    try {
      // Force a fresh load of Sportybet data to ensure we have the most up-to-date data
      const rawDataResponse = await storage.getBookmakerData('sporty', true);
      
      // Make a deep copy to avoid reference issues
      const sportyRawData = JSON.parse(JSON.stringify(rawDataResponse));
      
      if (Array.isArray(sportyRawData)) {
        logger.critical(`Found ${sportyRawData.length} raw Sportybet events to process`);
        
        // Track which Sportybet events we've processed to avoid duplicates
        const processedSportyEventIds = new Set();
        
        // Track event IDs we've already processed
        const processedEventIds = new Set();

        // Process each Sportybet event to ensure it gets included in eventMap
        // First update any existing events
        for (const event of sportyRawData) {
          const eventId = event.eventId || event.id || (event.raw && event.raw.originalEventId) || (event.raw && event.raw.eventId) || '';
          if (!eventId) continue;
          
          // Skip if already processed
          if (processedEventIds.has(eventId)) continue;
          processedEventIds.add(eventId);
          
          // Store that we've seen this Sportybet event
          processedSportyEventIds.add(eventId);
          
          // Check if the event already exists in the eventMap
          if (eventMap.has(eventId)) {
            // Get the existing event
            const existingEvent = eventMap.get(eventId);
            
            // Extract Sportybet odds from the current event
            let homeOdds = 0, drawOdds = 0, awayOdds = 0;
            
            if (event.odds) {
              homeOdds = event.odds.home || 0;
              drawOdds = event.odds.draw || 0;
              awayOdds = event.odds.away || 0;
            } else if (event.home_odds !== undefined && event.draw_odds !== undefined && event.away_odds !== undefined) {
              homeOdds = parseFloat(event.home_odds) || 0;
              drawOdds = parseFloat(event.draw_odds) || 0;
              awayOdds = parseFloat(event.away_odds) || 0;
            } else if (event.raw) {
              homeOdds = parseFloat(event.raw.home_odds) || 0;
              drawOdds = parseFloat(event.raw.draw_odds) || 0;
              awayOdds = parseFloat(event.raw.away_odds) || 0;
            }
            
            // Only update if we have valid odds
            if (homeOdds > 0 && drawOdds > 0 && awayOdds > 0) {
              // Deep copy the existing odds data to avoid reference modification
              const newOddsData = JSON.parse(JSON.stringify(existingEvent.oddsData || {}));
              
              // Update with Sportybet odds
              newOddsData['sporty'] = { home: homeOdds, draw: drawOdds, away: awayOdds };
              
              // Create a deep copy of the best odds
              const newBestOdds = JSON.parse(JSON.stringify(existingEvent.bestOdds || { home: 0, draw: 0, away: 0 }));
              
              // Update best odds if Sportybet has better odds
              newBestOdds.home = Math.max(newBestOdds.home || 0, homeOdds);
              newBestOdds.draw = Math.max(newBestOdds.draw || 0, drawOdds);
              newBestOdds.away = Math.max(newBestOdds.away || 0, awayOdds);
              
              // Create a completely new object for the event to avoid reference issues
              const updatedEvent = {
                ...JSON.parse(JSON.stringify(existingEvent)),
                oddsData: newOddsData,
                bestOdds: newBestOdds,
                lastUpdated: new Date()
              };
              
              // Replace the existing event in the map
              eventMap.set(eventId, updatedEvent);
              
              logger.info(`Updated existing event with Sportybet odds: ${existingEvent.teams}`);
            }
          } else {
            // This is a new event that needs to be added
            const teams = event.teams || event.event || (event.raw && event.raw.event) || 'Unknown';
            const bookmakerOdds = {};
            
            // Extract Sportybet odds
            let homeOdds = 0, drawOdds = 0, awayOdds = 0;
            
            if (event.odds) {
              homeOdds = event.odds.home || 0;
              drawOdds = event.odds.draw || 0;
              awayOdds = event.odds.away || 0;
            } else if (event.home_odds !== undefined && event.draw_odds !== undefined && event.away_odds !== undefined) {
              homeOdds = parseFloat(event.home_odds) || 0;
              drawOdds = parseFloat(event.draw_odds) || 0;
              awayOdds = parseFloat(event.away_odds) || 0;
            } else if (event.raw) {
              homeOdds = parseFloat(event.raw.home_odds) || 0;
              drawOdds = parseFloat(event.raw.draw_odds) || 0;
              awayOdds = parseFloat(event.raw.away_odds) || 0;
            }
            
            // Only add if we have valid odds
            if (homeOdds > 0 && drawOdds > 0 && awayOdds > 0) {
              bookmakerOdds['sporty'] = { home: homeOdds, draw: drawOdds, away: awayOdds };
              
              const country = event.country || (event.raw && event.raw.country) || '';
              const tournament = event.tournament || event.league || (event.raw && event.raw.tournament) || '';
              const date = event.date || (event.raw && event.raw.date) || new Date().toISOString().split('T')[0];
              const time = event.time || (event.raw && event.raw.time) || '12:00';
              
              // Create a new entry in the eventMap for this Sportybet event
              eventMap.set(eventId, {
                eventId,
                teams,
                oddsData: bookmakerOdds,
                bestOdds: bookmakerOdds['sporty'],
                league: `${country} ${tournament}`.trim() || 'Unknown',
                country,
                tournament,
                sportId: 1, // Default to football
                date,
                time,
                externalId: event.originalEventId || eventId,
                lastUpdated: new Date()
              });
              
              logger.info(`Added Sportybet event directly to eventMap: ${teams}`);
            }
          }
        }
        
        // CRITICAL: Log how many Sportybet events we processed
        logger.critical(`Processed ${processedSportyEventIds.size}/${sportyRawData.length} Sportybet events during direct injection`);
      }
    } catch (e) {
      logger.error(`Error processing raw Sportybet events: ${e.message}`);
    }
    
    // CRITICAL: Create deep copy of events to prevent reference issues
    const allEventsRaw = await storage.getEvents();
    const allEvents = JSON.parse(JSON.stringify(allEventsRaw));
    
    const currentEventIds = new Set(Array.from(eventMap.keys()));

    let deletedCount = 0;
    let retainedSportybetCount = 0;

    logger.info(`Cleaning up events that no longer meet criteria (preserving Sportybet events)...`);

    // Remove events that don't meet criteria anymore
    for (const event of allEvents) {
      // If this event is not in our current map and has an eventId, it would normally be removed
      if (event.eventId && !currentEventIds.has(event.eventId)) {
        // EXCEPTION: Don't delete if it has Sportybet odds
        const hasSportybetOdds = event.oddsData && 
                                 typeof event.oddsData === 'object' && 
                                 'sporty' in event.oddsData;
        
        if (hasSportybetOdds) {
          // Retain this event since it has Sportybet odds
          retainedSportybetCount++;
          continue;
        }
        
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

    logger.critical(`[${endTime.toISOString()}] Event mapping finished - ${currentEventIds.size} events mapped, ${deletedCount} events removed, ${retainedSportybetCount} Sportybet events retained, final count: ${allEvents.length - deletedCount}`);
    logger.critical(`[${endTime.toISOString()}] Events per bookmaker: ${bookmakerSummary}`);

    // Calculate and store tournament margins
    try {
      const { calculateAndStoreTournamentMargins } = await import('./tournamentMargins');
      await calculateAndStoreTournamentMargins(storage);
    } catch (marginError) {
      logger.critical('Error calculating tournament margins:', marginError);
      // Don't throw this error, as it shouldn't stop the main process
    }
  } catch (error) {
    logger.critical('Error processing and mapping events:', error);
    throw error;
  }
}

/**
 * Normalize event name for matching across bookmakers
 * This function is specifically optimized to make team name matching more reliable
 */
function normalizeEventName(eventName: string): string {
  if (!eventName) return '';

  // Function to normalize team names comprehensively
  function normalizeTeamName(team: string): string {
    // Handle special cases and common variations
    const specialCases: Record<string, string> = {
      // Club full names and common variations
      'manchester united': 'manchester',
      'manchester utd': 'manchester',
      'man united': 'manchester',
      'man utd': 'manchester',
      'man u': 'manchester',
      'manu': 'manchester',
      
      // Handle Manchester City variations
      'manchester city': 'manchestercity', // Special case to distinguish from Man United
      'man city': 'manchestercity',
      'man c': 'manchestercity',
      'ogc nice': 'nice',     // Specific case in the example
      'stade reims': 'reims', // Specific case in the example
      
      // Team name aliases
      'juventus turin': 'juventus',
      'inter milan': 'internazionale',
      'rb leipzig': 'leipzig',
      'psg': 'paris',
      'wolverhampton wanderers': 'wolverhampton',
      'wolves': 'wolverhampton',
      'tottenham hotspur': 'tottenham',
      'spurs': 'tottenham',
      'napoli sc': 'napoli',
      'ac milan': 'milan',
      'crystal palace': 'crystalpalace',
      'liver': 'liverpool',
      'arsenal': 'arsenal',
      'crystal': 'crystalpalace',
    };
    
    let normalized = team.toLowerCase()
      // Remove common suffixes
      .replace(/\s+(united|utd|city|town|county|albion|rovers|wanderers|athletic|hotspur|wednesday|forest|fc|academy|reserve|women|ladies|boys|girls|u\d+|under\d+|fc\.?)\b/g, '')
      // Remove common location prefixes but preserve them for disambiguation later
      .replace(/\b(west|east|north|south|central|real|atletico|deportivo|inter|lokomotiv|dynamo)\s+/g, '')
      // Remove country specifiers
      .replace(/\s+(ghana|kenya|uganda|tanzania|nigeria|zambia)\b/g, '')
      // Remove 'fc' (football club)
      .replace(/\s+fc\b|\bfc\s+|\s+football\s+club|\bfootball\s+club/g, '')
      // Replace ampersands with 'and'
      .replace(/&/g, 'and')
      // Standardize quotes and parentheses
      .replace(/['"''""()[\]{}]/g, '')
      // Trim whitespace
      .trim();
    
    // Check for special cases 
    for (const [pattern, replacement] of Object.entries(specialCases)) {
      if (normalized === pattern) {
        return replacement;
      }
    }
    
    // Final cleanup
    return normalized
      .replace(/\./g, '') // Remove periods
      .replace(/\s+/g, '') // Remove all whitespace
      .replace(/[^\w]/g, '') // Remove any remaining punctuation
      .trim();
  }

  // First standardize the event name format
  let normalized = eventName
    .toLowerCase()
    // Standardize separator to 'vs' for consistent processing
    .replace(/\s+v\.?\s+|\s+-\s+|\s+@\s+/g, ' vs ')
    // Standardize quotes and parentheses
    .replace(/['"''""()[\]{}]/g, '')
    .trim();

  // Now transform both team names separately if we have a vs separator
  if (normalized.includes(' vs ')) {
    const parts = normalized.split(' vs ');
    if (parts.length === 2) {
      // Normalize each team name separately
      const [team1, team2] = parts;
      const normalizedTeam1 = normalizeTeamName(team1);
      const normalizedTeam2 = normalizeTeamName(team2);

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