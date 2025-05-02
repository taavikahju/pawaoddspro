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
  
  // Handle cache updates when server events change - optimized for performance
  useEffect(() => {
    if (!serverEvents || serverEvents.length === 0) return;

    // Process in the next event loop to avoid blocking UI
    setTimeout(() => {
      try {
        // Check if this response has Sportybet data
        const sportyEventsCount = serverEvents.filter(event => 
          event.oddsData && 
          typeof event.oddsData === 'object' && 
          'sporty' in event.oddsData
        ).length;
        
        // Always maintain the cache with the most Sportybet odds
        if (sportyEventsCount > 0) {
          // If the server response has Sportybet data, update our cache without logging
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverEvents));
          setLocalCacheEvents(serverEvents);
        } else if (localCacheEvents.length > 0) {
          // Check cache for Sportybet data
          const cachedSportyEventsCount = localCacheEvents.filter(event => 
            event.oddsData && 
            typeof event.oddsData === 'object' && 
            'sporty' in event.oddsData
          ).length;
          
          if (cachedSportyEventsCount > 0) {
            // Merge data efficiently
            const mergedEvents = JSON.parse(JSON.stringify(serverEvents));
            const eventMap = new Map(mergedEvents.map((event: EventData) => [event.id, event]));
            
            // Process cached events and add Sportybet odds to server events
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
                  serverEvent.oddsData.sporty = JSON.parse(JSON.stringify(cachedEvent.oddsData.sporty));
                  addedCount++;
                }
              }
            });
            
            // Only update cache if we actually added odds
            if (addedCount > 0) {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mergedEvents));
              setLocalCacheEvents(mergedEvents);
            }
          }
        }
      } catch (error) {
        // Silent error handling to prevent console flooding
      }
    }, 0);
  }, [serverEvents]);
  
  // Handle error with useEffect
  useEffect(() => {
    if (isError) {
      handleError();
    }
  }, [isError, handleError]);

  // Load initial cache from localStorage on component mount - optimized for performance
  useEffect(() => {
    try {
      const cachedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          // Set cache silently without logging
          setLocalCacheEvents(parsedData);
        }
      }
    } catch (error) {
      // Only log critical errors
      console.error('Error loading events cache:', error);
    }
  }, []);

  // Combine server events with cached local events for Sportybet data - optimized for performance
  const mergeEvents = useCallback(() => {
    // If we have server data, use that as the base
    if (Array.isArray(serverEvents) && serverEvents.length > 0) {
      // ALWAYS merge with cached data if we have it
      if (localCacheEvents.length > 0) {
        // Create a shallow copy of the server events
        const mergedEvents = [...serverEvents];
        
        // Create a map of events by ID for quick lookup - faster than filtering arrays repeatedly
        const eventMap = new Map();
        mergedEvents.forEach(event => {
          eventMap.set(event.id, event);
        });
        
        // For each cached event that has Sportybet data, add the Sportybet data to merged events
        localCacheEvents.forEach(cachedEvent => {
          if (
            cachedEvent.oddsData && 
            typeof cachedEvent.oddsData === 'object' && 
            'sporty' in cachedEvent.oddsData &&
            cachedEvent.id
          ) {
            const serverEvent = eventMap.get(cachedEvent.id);
            if (serverEvent) {
              // Ensure oddsData exists
              if (!serverEvent.oddsData) {
                serverEvent.oddsData = {};
              }
              // Copy Sportybet odds from cache without deep clone (faster)
              serverEvent.oddsData.sporty = cachedEvent.oddsData.sporty;
            }
          }
        });
        
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

  // No debug logging to improve performance
  // const events = mergeEvents();

  // Add test method to simulate disconnection - with minimal logging
  const testResilience = useCallback(() => {
    // First ensure we have cache
    if (Array.isArray(serverEvents) && serverEvents.length > 0) {
      try {
        // Store these events in localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverEvents));
        setLocalCacheEvents(serverEvents);
        
        // Now create a modified copy without Sportybet data to simulate disconnection
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
      } catch (error) {
        // Silent error handling
      }
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