import { IStorage } from '../storage';
import { insertEventSchema, type InsertEvent, events } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { saveOddsHistory } from './oddsHistory';

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
    console.log('🔄 Processing scraped data...');
    
    // Get all bookmaker data
    const allBookmakerData = await storage.getAllBookmakersData();
    const bookmakerCodes = Object.keys(allBookmakerData);
    
    // Use maps to track events by their eventId (for exact matching across bookmakers)
    const eventMap = new Map<string, any>();
    const processedEvents = new Set<string>(); // Track which eventIds we've processed
    
    // Special handling for Sportybet to track its events for secondary matching
    const sportyEvents = [];
    if (allBookmakerData['sporty'] && Array.isArray(allBookmakerData['sporty'])) {
      sportyEvents.push(...allBookmakerData['sporty']);
      console.log(`🔍 Identified ${sportyEvents.length} Sportybet events for special processing`);
    }
    
    // Create team name maps for all bookmakers for secondary matching
    const bookmakerTeamMaps = new Map<string, Map<string, any>>();
    
    // Initialize team maps for each bookmaker
    for (const bookmakerCode of bookmakerCodes) {
      bookmakerTeamMaps.set(bookmakerCode, new Map<string, any>());
    }
    
    // Create map of team names to Sportybet events for secondary matching
    const sportyTeamsMap = new Map();
    sportyEvents.forEach(event => {
      if (event.teams) {
        const normalizedTeams = normalizeEventName(event.teams);
        sportyTeamsMap.set(normalizedTeams, event);
      }
    });
    console.log(`🔄 Created team-based index for ${sportyTeamsMap.size} Sportybet events`);
    
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
        }
      }
      
      console.log(`🔄 Created team-based index for ${teamMap.size} ${bookmakerCode} events`);
    }
    
    // First pass: collect all eventIds from all bookmakers
    const allEventIds = new Set<string>();
    for (const bookmakerCode of bookmakerCodes) {
      const bookmakerData = allBookmakerData[bookmakerCode];
      if (!bookmakerData || !Array.isArray(bookmakerData)) continue;
      
      for (const event of bookmakerData) {
        if (event.eventId) {
          allEventIds.add(event.eventId);
        }
      }
    }
    
    console.log(`📊 Found ${allEventIds.size} unique events to process`);
    
    // Stats counters to track filtering results
    let eventsWith1Bookmaker = 0;
    let eventsWith2Bookmakers = 0;
    let eventsWith3Bookmakers = 0;
    let eventsWith4Bookmakers = 0;
    let bookmakerEventsMapped = 0;
    
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
        const event = bookmakerData.find(e => e.eventId === eventId);
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
        }
      }
      
      // Track the number of bookmakers for each event
      if (bookmakerCount === 1) eventsWith1Bookmaker++;
      else if (bookmakerCount === 2) eventsWith2Bookmakers++;
      else if (bookmakerCount === 3) eventsWith3Bookmakers++;
      else if (bookmakerCount >= 4) eventsWith4Bookmakers++;

      // Only process events where at least 2 bookmakers have odds (reduced from 3 per user request)
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
        
        // Only log for specific countries/tournaments we're debugging
        if (baseMatch && 
           (country.toLowerCase().includes('england') || 
            tournament.toLowerCase().includes('national league'))) {
          console.log(`🔹 Using betPawa Ghana data for England/National League event ${eventId} - Country: [${country}], Tournament: [${tournament}]`);
        }
        
        // Create the teams field if not already available
        let teams = dataSource.teams;
        if (!teams && dataSource.event) {
          teams = dataSource.event;
        }
        
        // Create event in our map
        eventMap.set(eventId, {
          externalId: dataSource.id || eventId,
          eventId: eventId,
          teams: teams || 'Unknown',
          league: league || 'Unknown',
          country: country || null,
          tournament: tournament || null,
          sportId: getSportId(dataSource.sport || 'football'),
          date: dataSource.date || dataSource.start_time?.split(' ')[0] || 'Unknown',
          time: dataSource.time || dataSource.start_time?.split(' ')[1] || 'Unknown',
          oddsData: bookmakerOdds,
          bestOdds: {}
        });
      }
    }
    
    // Calculate best odds for each event
    for (const [eventKey, eventData] of Array.from(eventMap.entries())) {
      const bestOdds: any = {};
      const allOdds = eventData.oddsData;
      
      // Check each possible market (home, draw, away)
      ['home', 'draw', 'away'].forEach(market => {
        let best = 0;
        
        // Compare odds across all bookmakers
        Object.keys(allOdds).forEach(bookmakerCode => {
          const bookieOdds = allOdds[bookmakerCode];
          if (bookieOdds && bookieOdds[market] && bookieOdds[market] > best) {
            best = bookieOdds[market];
          }
        });
        
        if (best > 0) {
          bestOdds[market] = best;
        }
      });
      
      eventData.bestOdds = bestOdds;
    }
    
    // Third pass: Secondary matching for all bookmakers' events not yet mapped
    // This allows events with different eventIds but same team names to be matched
    console.log(`🔍 Starting secondary matching for all bookmakers...`);
    
    const bookmakersMapped = {
      'sporty': 0,
      'bp GH': 0,
      'bp KE': 0,
      'betika KE': 0
    };
    
    // Process each event in our map
    for (const [eventId, eventData] of Array.from(eventMap.entries())) {
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
            
            if (bookieEvent) {
              console.log(`✅ Matched ${bookmakerCode} event using reversed team names: ${eventData.teams}`);
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
              bookmakersMapped[bookmakerCode] = (bookmakersMapped[bookmakerCode] || 0) + 1;
              
              // Only log for Sportybet to avoid cluttering logs
              if (bookmakerCode === 'sporty') {
                console.log(`✅ Secondary matched ${bookmakerCode} event for: ${eventData.teams}`);
              }
            }
          }
        }
      }
    }
    
    // Log summary of secondary matching
    console.log(`🔄 Secondary matching success:`);
    for (const [bookmakerCode, count] of Object.entries(bookmakersMapped)) {
      if (count > 0) {
        console.log(`  - Added ${count} events from ${bookmakerCode}`);
        bookmakerEventsMapped += count; // Update total count
      }
    }
    console.log(`🔄 Secondary matching added odds to ${bookmakerEventsMapped} total event-bookmaker combinations`);
    
    // Store or update events in database
    for (const [eventKey, eventData] of Array.from(eventMap.entries())) {
      try {
        // Check if event already exists by eventId first (this is more reliable than externalId)
        let existingEvent = await storage.getEventByEventId(eventData.eventId);
        
        // If not found by eventId, try by externalId as a fallback
        if (!existingEvent) {
          existingEvent = await storage.getEventByExternalId(eventData.externalId);
        }
        
        if (existingEvent) {
          // Save historical odds data for each bookmaker
          const newOdds = eventData.oddsData;
          const existingOdds = existingEvent.oddsData as Record<string, any>;
          
          // Track odds history for each bookmaker
          for (const bookmakerCode of Object.keys(newOdds)) {
            const bookieOdds = newOdds[bookmakerCode];
            
            // Only save history if odds exist
            if (bookieOdds && (bookieOdds.home || bookieOdds.draw || bookieOdds.away)) {
              // Record every scrape, regardless of whether odds have changed
              // This gives us the most detailed history possible
              await saveOddsHistory(
                eventData.eventId,
                eventData.externalId,
                bookmakerCode,
                bookieOdds.home,
                bookieOdds.draw,
                bookieOdds.away
              );
            }
          }
          
          // Update existing event
          await storage.updateEvent(existingEvent.id, {
            oddsData: eventData.oddsData,
            bestOdds: eventData.bestOdds,
            // Also update other fields that might have changed
            teams: eventData.teams,
            league: eventData.league,
            country: eventData.country,
            tournament: eventData.tournament,
            date: eventData.date,
            time: eventData.time
          });
          // Skip individual event update logs to reduce console noise
          // console.log(`Updated event ${existingEvent.id} with eventId ${eventData.eventId}`);
        } else {
          // Create new event
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
          
          // Insert new event
          const createdEvent = await storage.createEvent(validatedData);
          // Skip individual event creation logs to reduce console noise
          // console.log(`Created new event with eventId ${eventData.eventId}`);
          
          // Save initial historical odds data for each bookmaker for new events too
          const newOdds = eventData.oddsData;
          for (const bookmakerCode of Object.keys(newOdds)) {
            const bookieOdds = newOdds[bookmakerCode];
            
            // Only save history if odds exist
            if (bookieOdds && (bookieOdds.home || bookieOdds.draw || bookieOdds.away)) {
              await saveOddsHistory(
                eventData.eventId,
                eventData.externalId,
                bookmakerCode,
                bookieOdds.home,
                bookieOdds.draw,
                bookieOdds.away
              );
            }
          }
        }
      } catch (error) {
        console.error(`Error processing event ${eventKey}:`, error);
      }
    }
    
    // Count events by bookmaker
    const eventsByBookmaker = {};
    for (const bookmakerCode of bookmakerCodes) {
      eventsByBookmaker[bookmakerCode] = 0;
    }
    
    // Count how many events each bookmaker has odds for
    for (const [eventId, eventData] of eventMap.entries()) {
      const oddsData = eventData.oddsData || {};
      for (const bookmakerCode of Object.keys(oddsData)) {
        if (eventsByBookmaker[bookmakerCode] !== undefined) {
          eventsByBookmaker[bookmakerCode]++;
        }
      }
    }
    
    // Log distribution of events by bookmaker count with emojis for better readability
    console.log(`📊 Event distribution by bookmaker count:`);
    console.log(`  - Events with 1 bookmaker: ${eventsWith1Bookmaker}`);
    console.log(`  - Events with 2 bookmakers: ${eventsWith2Bookmakers}`);
    console.log(`  - Events with 3 bookmakers: ${eventsWith3Bookmakers}`);
    console.log(`  - Events with 4+ bookmakers: ${eventsWith4Bookmakers}`);
    
    // Log events count by bookmaker
    console.log(`📊 Events count by bookmaker (after mapping):`);
    for (const [code, count] of Object.entries(eventsByBookmaker)) {
      console.log(`  - ${code}: ${count} events`);
    }
    
    console.log(`✅ Processed ${eventMap.size} events with at least 2 bookmakers`);
    
    // Get all events and delete any that don't meet our criteria anymore
    // This ensures events that previously had 3+ bookmakers but now have fewer are removed
    const allEvents = await storage.getEvents();
    const currentEventIds = new Set(Array.from(eventMap.keys()));
    
    let deletedCount = 0;
    
    console.log(`🧹 Cleaning up events that no longer meet criteria...`);
    
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
    
    // Log summary of cleanup
    console.log(`========== EVENTS CLEANUP SUMMARY ==========`);
    console.log(`Starting events count: ${allEvents.length}`);
    console.log(`Events meeting criteria (2+ bookmakers): ${currentEventIds.size}`);
    console.log(`Events removed: ${deletedCount}`);
    console.log(`Final events count: ${allEvents.length - deletedCount}`);
    console.log(`===========================================`);
    
    // Calculate and store tournament margins
    try {
      const { calculateAndStoreTournamentMargins } = await import('./tournamentMargins');
      await calculateAndStoreTournamentMargins(storage);
    } catch (marginError) {
      console.error('Error calculating tournament margins:', marginError);
      // Don't throw this error, as it shouldn't stop the main process
    }
  } catch (error) {
    console.error('Error processing and mapping events:', error);
    throw error;
  }
}

/**
 * Normalize event name for matching across bookmakers
 * This function is specifically optimized to make team name matching more reliable
 */
function normalizeEventName(eventName: string): string {
  if (!eventName) return '';
  
  return eventName
    .toLowerCase()
    // Remove common separators (vs, v, -, @)
    .replace(/\s+vs\.?\s+|\s+v\.?\s+|\s+-\s+|\s+@\s+/g, '')
    // Remove 'fc' (football club)
    .replace(/\s+fc\b|\bfc\s+|\s+football\s+club|\bfootball\s+club/g, '')
    // Remove common suffixes - expanded list
    .replace(/\s+(united|utd|city|town|county|albion|rovers|wanderers|athletic|hotspur|wednesday|forest|fc|academy|reserve|women|ladies|boys|girls|u\d+|under\d+)\b/g, '')
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
    // Remove periods and special characters
    .replace(/\./g, '')
    // Remove all whitespace
    .replace(/\s+/g, '')
    // Remove any remaining punctuation
    .replace(/[^\w]/g, '')
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
