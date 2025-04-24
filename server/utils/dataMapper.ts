import { IStorage } from '../storage';
import { insertEventSchema, type InsertEvent } from '@shared/schema';

/**
 * Maps events from different bookmakers by matching teams and times
 */
export async function processAndMapEvents(storage: IStorage): Promise<void> {
  try {
    console.log('Processing and mapping events...');
    
    // Get all bookmaker data
    const allBookmakerData = await storage.getAllBookmakersData();
    const bookmakerCodes = Object.keys(allBookmakerData);
    
    // Use maps to track events by their normalized name (for matching across bookmakers)
    const eventMap = new Map<string, any>();
    const eventKeyMap = new Map<string, string>();
    
    // Process each bookmaker's data
    for (const bookmakerCode of bookmakerCodes) {
      const bookmakerData = allBookmakerData[bookmakerCode];
      if (!bookmakerData || !Array.isArray(bookmakerData)) continue;
      
      for (const event of bookmakerData) {
        if (!event.teams || !event.league) continue;
        
        // Normalize event name for matching (remove vs, spaces, convert to lowercase)
        const eventKey = normalizeEventName(event.teams);
        eventKeyMap.set(event.id, eventKey);
        
        // Create or update event in our map
        if (!eventMap.has(eventKey)) {
          eventMap.set(eventKey, {
            externalId: event.id,
            teams: event.teams,
            league: event.league,
            sportId: getSportId(event.sport || 'football'),
            date: event.date || 'Unknown',
            time: event.time || 'Unknown',
            oddsData: {},
            bestOdds: {}
          });
        }
        
        // Add this bookmaker's odds to the event
        const mappedEvent = eventMap.get(eventKey);
        if (event.odds) {
          mappedEvent.oddsData[bookmakerCode] = event.odds;
        }
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
