import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

// Define a type for the event structure
interface EventData {
  id: number;
  teams: string;
  date: string;
  time: string;
  sportId: number;
  country?: string | null;
  tournament?: string | null;
  oddsData: Record<string, any>;
  [key: string]: any; // Allow for additional properties
}

/**
 * This custom hook provides resilience against server disconnections
 * It stores a local copy of the events data in localStorage to keep
 * Sportybet odds available even when the server disconnects
 */
export function useOfflineResilientEvents() {
  const LOCAL_STORAGE_KEY = 'pawaodds_events_cache';
  const [localCacheEvents, setLocalCacheEvents] = useState<EventData[]>([]);
  
  // Handler for successful API response
  const handleSuccess = useCallback((data: any) => {
    // If we get valid data from the server, update our local cache
    if (Array.isArray(data) && data.length > 0) {
      try {
        // Only update the cache if we have Sportybet data
        const sportyEvents = data.filter((event: EventData) => 
          event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData
        );
        
        // Only update local cache if we have Sportybet data
        if (sportyEvents.length > 0) {
          console.log(`Caching ${sportyEvents.length} events with Sportybet odds to localStorage`);
          
          // Store the entire dataset - we'll merge with local cache on disconnection
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
          setLocalCacheEvents(data);
        }
      } catch (error) {
        console.error('Error saving events to localStorage:', error);
      }
    }
  }, []);

  // Handler for API error
  const handleError = useCallback(() => {
    console.log('Error fetching events, falling back to local cache');
    // On error, try to load from local cache
    try {
      const cachedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          console.log(`Using ${parsedData.length} cached events from localStorage`);
          setLocalCacheEvents(parsedData);
        }
      }
    } catch (error) {
      console.error('Error loading events from localStorage:', error);
    }
  }, []);
  
  // Main query for events
  const { 
    data: serverEvents = [],
    isLoading,
    error,
    isError,
  } = useQuery<EventData[]>({ 
    queryKey: ['/api/events'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });
  
  // Always update cache on successful response that contains Sportybet data
  useEffect(() => {
    if (serverEvents && serverEvents.length > 0) {
      // Check if this response has Sportybet data
      const sportyEventsCount = serverEvents.filter(event => 
        event.oddsData && 
        typeof event.oddsData === 'object' && 
        'sporty' in event.oddsData
      ).length;
      
      // Only update the cache if we have at least some Sportybet data
      // This prevents caching responses that are missing Sportybet data
      if (sportyEventsCount > 0) {
        console.log(`Updating cache with ${sportyEventsCount} Sportybet events`);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverEvents));
        setLocalCacheEvents(serverEvents);
      } else {
        console.log('Server response missing Sportybet data, not updating cache');
      }
    }
  }, [serverEvents]);
  
  // Handle error with useEffect
  useEffect(() => {
    if (isError) {
      handleError();
    }
  }, [isError, handleError]);

  // Load initial cache from localStorage on component mount
  useEffect(() => {
    try {
      const cachedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          console.log(`Loaded ${parsedData.length} cached events from localStorage on init`);
          setLocalCacheEvents(parsedData);
        }
      }
    } catch (error) {
      console.error('Error loading initial events from localStorage:', error);
    }
  }, []);

  // Combine server events with cached local events for Sportybet data
  const mergeEvents = useCallback(() => {
    // If we have server data, use that as the base
    if (Array.isArray(serverEvents) && serverEvents.length > 0) {
      // Count Sportybet events in server data
      const sportyEventsCount = serverEvents.filter(event => 
        event.oddsData && 
        typeof event.oddsData === 'object' && 
        'sporty' in event.oddsData
      ).length;
      
      console.log(`Server events have ${sportyEventsCount} events with Sportybet odds`);
      
      // Merge with cached data if we have it and it has more Sportybet odds
      if (localCacheEvents.length > 0) {
        // Count Sportybet events in cached data
        const cachedSportyEventsCount = localCacheEvents.filter(event => 
          event.oddsData && 
          typeof event.oddsData === 'object' && 
          'sporty' in event.oddsData
        ).length;
        
        console.log(`Cached events have ${cachedSportyEventsCount} events with Sportybet odds`);
        
        // If cache has more Sportybet events, merge them
        if (cachedSportyEventsCount > sportyEventsCount) {
          console.log(`Cache has more Sportybet events, merging...`);
          
          // Create a deep copy of the server events to avoid mutation
          const mergedEvents = JSON.parse(JSON.stringify(serverEvents));
          
          // Create a map of events by ID for quick lookup
          const eventMap = new Map(mergedEvents.map((event: EventData) => [event.id, event]));
          
          // For each cached event that has Sportybet data, add the Sportybet data to merged events
          localCacheEvents.forEach(cachedEvent => {
            if (
              cachedEvent.oddsData && 
              typeof cachedEvent.oddsData === 'object' && 
              'sporty' in cachedEvent.oddsData
            ) {
              const serverEvent = eventMap.get(cachedEvent.id);
              if (serverEvent) {
                // Only update if server event doesn't have Sportybet odds
                if (!serverEvent.oddsData || !serverEvent.oddsData.sporty) {
                  if (!serverEvent.oddsData) {
                    serverEvent.oddsData = {};
                  }
                  // Copy Sportybet odds from cache
                  serverEvent.oddsData.sporty = JSON.parse(JSON.stringify(cachedEvent.oddsData.sporty));
                  console.log(`Added sporty odds for event ID ${cachedEvent.id}: ${cachedEvent.teams}`);
                }
              }
            }
          });
          
          // Count again after merging
          const finalSportyCount = mergedEvents.filter((event: EventData) => 
            event.oddsData && 
            typeof event.oddsData === 'object' && 
            'sporty' in event.oddsData
          ).length;
          
          console.log(`After merging: ${finalSportyCount} events with Sportybet odds`);
          
          return mergedEvents;
        }
      }
      
      // If cache doesn't have more Sportybet events, use server data directly
      return serverEvents;
    }

    // If no server data, use cached events
    return localCacheEvents;
  }, [serverEvents, localCacheEvents]);

  // The final merged events array
  const events = mergeEvents();

  // Debug output
  useEffect(() => {
    if (events.length > 0) {
      const sportyEvents = events.filter(event => 
        event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData
      );
      console.log(`Final events array has ${sportyEvents.length} events with Sportybet odds out of ${events.length} total`);

      // Check for a specific bookmaker combination
      const sportyAndOtherBookies = events.filter(event => {
        if (!event.oddsData) return false;
        
        const bookmakers = Object.keys(event.oddsData);
        return bookmakers.includes('sporty') && bookmakers.length > 1;
      });
      
      console.log(`Events with Sportybet AND at least one other bookmaker: ${sportyAndOtherBookies.length}`);
    }
  }, [events]);

  // Add test method to simulate disconnection
  const testResilience = useCallback(() => {
    console.log("Testing resilience by simulating server disconnection...");
    
    // First ensure we have cache
    if (Array.isArray(serverEvents) && serverEvents.length > 0) {
      try {
        const sportyEvents = serverEvents.filter(event => 
          event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData
        );
        
        console.log(`Found ${sportyEvents.length} events with Sportybet odds before test`);
        
        // Store these events in localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverEvents));
        setLocalCacheEvents(serverEvents);
        
        // Now create a modified copy without Sportybet data to simulate disconnection
        // In a real scenario, the server would disconnect and React Query would return
        // cached data without Sportybet
        const eventsWithoutSporty = serverEvents.map(event => {
          const newEvent = {...event};
          if (newEvent.oddsData && 'sporty' in newEvent.oddsData) {
            newEvent.oddsData = {...newEvent.oddsData};
            delete newEvent.oddsData.sporty;
          }
          return newEvent;
        });
        
        // Force our hook to use this modified data temporarily
        handleError();
        
        // Update server events directly (this simulates the React Query cache without Sportybet)
        // @ts-ignore - we're deliberately overriding this for testing
        serverEvents.splice(0, serverEvents.length, ...eventsWithoutSporty);
        
        setTimeout(() => {
          const mergedEvents = mergeEvents();
          const sportyEventsAfter = mergedEvents.filter(event => 
            event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData
          );
          console.log(`After disconnection simulation: ${sportyEventsAfter.length} events with Sportybet odds`);
          console.log("Test complete - check if Sportybet odds were successfully restored from localStorage");
        }, 100);
      } catch (error) {
        console.error("Error during resilience test:", error);
      }
    } else {
      console.error("Cannot test resilience - no events loaded yet");
    }
  }, [serverEvents, handleError]);

  return {
    events,
    isLoading,
    error,
    isError,
    testResilience
  };
}