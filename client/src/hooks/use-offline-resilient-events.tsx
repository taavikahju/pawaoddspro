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
  
  // Main query for events with includeSportybet=true to get all Sportybet events
  const { 
    data: serverEvents = [],
    isLoading,
    error,
    isError,
  } = useQuery<EventData[]>({ 
    queryKey: ['/api/events?includeSportybet=true'],
    // Removed refetchInterval as data only updates after scraper runs (every 30 minutes)
    // The page will now only fetch data on initial load or manual refresh
  });
  
  // Handle cache updates when server events change
  useEffect(() => {
    if (serverEvents && serverEvents.length > 0) {
      // Check if this response has Sportybet data
      const sportyEventsCount = serverEvents.filter(event => 
        event.oddsData && 
        typeof event.oddsData === 'object' && 
        'sporty' in event.oddsData
      ).length;
      
      // Always maintain the cache with the most Sportybet odds
      // EITHER from the server OR from our existing cache
      if (sportyEventsCount > 0) {
        // If the server response has Sportybet data, update our cache
        console.log(`[Events Hook] Updating cache with ${sportyEventsCount} Sportybet events from server`);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverEvents));
        setLocalCacheEvents(serverEvents);
      } else {
        // If the server response is missing Sportybet data but we have cached data with Sportybet odds
        // we need to merge our cache with the server data and store it
        console.log('[Events Hook] Server response missing Sportybet data, checking cache...');
        
        if (localCacheEvents.length > 0) {
          const cachedSportyEventsCount = localCacheEvents.filter(event => 
            event.oddsData && 
            typeof event.oddsData === 'object' && 
            'sporty' in event.oddsData
          ).length;
          
          if (cachedSportyEventsCount > 0) {
            console.log(`[Events Hook] Found ${cachedSportyEventsCount} cached events with Sportybet odds`);
            
            // Create a merged version of the data
            const mergedEvents = JSON.parse(JSON.stringify(serverEvents));
            const eventMap = new Map(mergedEvents.map((event: EventData) => [event.id, event]));
            
            let addedCount = 0;
            localCacheEvents.forEach(cachedEvent => {
              if (
                cachedEvent.oddsData && 
                typeof cachedEvent.oddsData === 'object' && 
                'sporty' in cachedEvent.oddsData
              ) {
                const serverEvent = eventMap.get(cachedEvent.id);
                if (serverEvent) {
                  if (!serverEvent.oddsData) {
                    serverEvent.oddsData = {};
                  }
                  // Copy Sportybet odds from cache
                  serverEvent.oddsData.sporty = JSON.parse(JSON.stringify(cachedEvent.oddsData.sporty));
                  addedCount++;
                }
              }
            });
            
            console.log(`[Events Hook] Added Sportybet odds to ${addedCount} events in cache`);
            
            // Update our cache with the merged data
            if (addedCount > 0) {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mergedEvents));
              setLocalCacheEvents(mergedEvents);
            }
          }
        }
      }
    }
  }, [serverEvents, localCacheEvents]);
  
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
      
      console.log(`[Events Hook] Server events have ${sportyEventsCount} events with Sportybet odds`);
      
      // ALWAYS merge with cached data if we have it
      if (localCacheEvents.length > 0) {
        // Count Sportybet events in cached data
        const cachedSportyEventsCount = localCacheEvents.filter(event => 
          event.oddsData && 
          typeof event.oddsData === 'object' && 
          'sporty' in event.oddsData
        ).length;
        
        console.log(`[Events Hook] Cached events have ${cachedSportyEventsCount} events with Sportybet odds`);
        
        // Always merge regardless of which one has more Sportybet odds
        console.log(`[Events Hook] Merging Sportybet odds from cache with server events`);
        
        // Create a deep copy of the server events to avoid mutation
        const mergedEvents = JSON.parse(JSON.stringify(serverEvents));
        
        // Create a map of events by ID for quick lookup
        const eventMap = new Map(mergedEvents.map((event: EventData) => [event.id, event]));
        
        // For each cached event that has Sportybet data, add the Sportybet data to merged events
        let addedCount = 0;
        localCacheEvents.forEach(cachedEvent => {
          if (
            cachedEvent.oddsData && 
            typeof cachedEvent.oddsData === 'object' && 
            'sporty' in cachedEvent.oddsData
          ) {
            const serverEvent = eventMap.get(cachedEvent.id);
            if (serverEvent) {
              // ALWAYS update Sportybet odds from cache, regardless of whether server has them
              // This ensures we always have the latest cached Sportybet odds
              if (!serverEvent.oddsData) {
                serverEvent.oddsData = {};
              }
              // Copy Sportybet odds from cache
              serverEvent.oddsData.sporty = JSON.parse(JSON.stringify(cachedEvent.oddsData.sporty));
              addedCount++;
            }
          }
        });
        
        console.log(`[Events Hook] Added/updated Sportybet odds for ${addedCount} events from cache`);
        
        // Count again after merging
        const finalSportyCount = mergedEvents.filter((event: EventData) => 
          event.oddsData && 
          typeof event.oddsData === 'object' && 
          'sporty' in event.oddsData
        ).length;
        
        console.log(`[Events Hook] After merging: ${finalSportyCount} events with Sportybet odds`);
        
        return mergedEvents;
      }
      
      // If no cache, use server data directly
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