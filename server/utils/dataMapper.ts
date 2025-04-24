import { IStorage } from '../storage';
import { insertEventSchema, type InsertEvent } from '@shared/schema';

/**
 * Maps events from different bookmakers by matching exact eventIds
 */
export async function processAndMapEvents(storage: IStorage): Promise<void> {
  try {
    console.log('Processing and mapping events...');
    
    // Get all bookmaker data
    const allBookmakerData = await storage.getAllBookmakersData();
    const bookmakerCodes = Object.keys(allBookmakerData);
    
    // Use maps to track events by their eventId (for exact matching across bookmakers)
    const eventMap = new Map<string, any>();
    const processedEvents = new Set<string>(); // Track which eventIds we've processed
    
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
    
    console.log(`Found ${allEventIds.size} unique eventIds across all bookmakers`);
    
    // Second pass: Process each bookmaker's data and group by eventId
    for (const eventId of allEventIds) {
      let firstMatch = null;
      const bookmakerOdds = {};
      
      // Look for this eventId in all bookmakers
      for (const bookmakerCode of bookmakerCodes) {
        const bookmakerData = allBookmakerData[bookmakerCode];
        if (!bookmakerData || !Array.isArray(bookmakerData)) continue;
        
        // Find event with this ID in current bookmaker
        const event = bookmakerData.find(e => e.eventId === eventId);
        if (!event) continue;
        
        // Use first match as the base event data
        if (!firstMatch) {
          firstMatch = event;
        }
        
        // Store odds from this bookmaker
        if (event.odds) {
          bookmakerOdds[bookmakerCode] = event.odds;
        }
      }
      
      // If we found at least one match and it has the required data
      if (firstMatch && firstMatch.teams && firstMatch.league) {
        // Create event in our map
        eventMap.set(eventId, {
          externalId: firstMatch.id || eventId,
          eventId: eventId,
          teams: firstMatch.teams,
          league: firstMatch.league,
          sportId: getSportId(firstMatch.sport || 'football'),
          date: firstMatch.date || 'Unknown',
          time: firstMatch.time || 'Unknown',
          oddsData: bookmakerOdds,
          bestOdds: {}
        });
      }
    }
    
    // Calculate best odds for each event
    for (const [eventKey, eventData] of eventMap.entries()) {
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
    
    // Store or update events in database
    for (const [eventKey, eventData] of eventMap.entries()) {
      try {
        // Check if event already exists by externalId
        const existingEvent = await storage.getEventByExternalId(eventData.externalId);
        
        if (existingEvent) {
          // Update existing event
          await storage.updateEvent(existingEvent.id, {
            oddsData: eventData.oddsData,
            bestOdds: eventData.bestOdds
          });
        } else {
          // Create new event
          const insertData: InsertEvent = {
            externalId: eventData.externalId,
            eventId: eventData.eventId,
            teams: eventData.teams,
            league: eventData.league,
            sportId: eventData.sportId,
            date: eventData.date,
            time: eventData.time,
            oddsData: eventData.oddsData,
            bestOdds: eventData.bestOdds
          };
          
          // Validate event data
          const validatedData = insertEventSchema.parse(insertData);
          
          // Insert new event
          await storage.createEvent(validatedData);
        }
      } catch (error) {
        console.error(`Error processing event ${eventKey}:`, error);
      }
    }
    
    console.log(`Processed and mapped ${eventMap.size} events`);
  } catch (error) {
    console.error('Error processing and mapping events:', error);
    throw error;
  }
}

/**
 * Normalize event name for matching across bookmakers
 */
function normalizeEventName(eventName: string): string {
  return eventName
    .toLowerCase()
    .replace(/\s+vs\s+|\s+v\s+|\s+-\s+/g, '')
    .replace(/\s+/g, '')
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
