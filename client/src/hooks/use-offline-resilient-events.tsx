import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealWebSocket } from './use-real-websocket';

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
  const lastUpdateTimestamp = useRef<number>(Date.now());
  
  // Get WebSocket updates
  const { lastMessage } = useRealWebSocket();
  
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
          // No logging for cache updates
          
          // Only store Sportybet data to reduce the size of localStorage cache
          const sportyEvents = data.filter((event: EventData) => 
            event.oddsData && 
            typeof event.oddsData === 'object' && 
            'sporty' in event.oddsData
          );
          
          // Store IDs and Sportybet odds only - much smaller data footprint
          const minimalSportyCache = sportyEvents.map((event: EventData) => ({
            id: event.id,
            oddsData: {
              sporty: event.oddsData.sporty
            }
          }));
          
          // Store the compressed dataset
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(minimalSportyCache));
          setLocalCacheEvents(data);
        }
      } catch (error) {
        // Silent error handling for performance
      }
    }
  }, []);

  // Handler for API error
  const handleError = useCallback(() => {
    // Silent fallback to local cache
    // On error, try to load from local cache
    try {
      const cachedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          // Silent usage of cached events
          setLocalCacheEvents(parsedData);
        }
      }
    } catch (error) {
      // Silent error handling for performance
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
          // If the server response has Sportybet data, update our cache with minimized data
          // Only store Sportybet data to reduce the size of localStorage cache
          const filteredSportyEvents = serverEvents.filter(event => 
            event.oddsData && 
            typeof event.oddsData === 'object' && 
            'sporty' in event.oddsData
          );
          
          // Store IDs and Sportybet odds only - much smaller data footprint
          const minimalSportyCache = filteredSportyEvents.map(event => ({
            id: event.id,
            oddsData: {
              sporty: event.oddsData.sporty
            }
          }));
          
          // Store the compressed dataset
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(minimalSportyCache));
          setLocalCacheEvents(serverEvents);
        } else if (localCacheEvents.length > 0) {
          // Check cache for Sportybet data
          const cachedSportyEventsCount = localCacheEvents.filter(event => 
            event.oddsData && 
            typeof event.oddsData === 'object' && 
            'sporty' in event.oddsData
          ).length;
          
          if (cachedSportyEventsCount > 0) {
            // Merge data more efficiently - avoid deep cloning
            const mergedEvents = [...serverEvents]; // Shallow copy is sufficient
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
                  // Use direct reference instead of deep clone - much faster
                  serverEvent.oddsData.sporty = cachedEvent.oddsData.sporty;
                  addedCount++;
                }
              }
            });
            
            // Only update cache if we actually added odds
            if (addedCount > 0) {
              // Only store Sportybet data to minimize cache size
              const filteredForStorage = mergedEvents.map(event => {
                if (event.oddsData && 'sporty' in event.oddsData) {
                  return {
                    id: event.id,
                    oddsData: {
                      sporty: event.oddsData.sporty
                    }
                  };
                }
                return null;
              }).filter(Boolean);
              
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filteredForStorage));
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
  
  // Access the query client for refetching data
  const queryClient = useQueryClient();
  
  // Listen for WebSocket events to trigger immediate updates
  useEffect(() => {
    if (lastMessage) {
      // When a scraper finishes, refresh data immediately
      if (
        lastMessage.type === 'scraperFinished' || 
        lastMessage.type === 'events' || 
        lastMessage.type === 'scrapeCompleted'
      ) {
        // Update timestamp
        lastUpdateTimestamp.current = Date.now();
        
        // Invalidate the queries to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['/api/events'] });
        queryClient.invalidateQueries({ queryKey: ['/api/events?includeSportybet=true'] });
        
        // If message contains events data, process it
        if (lastMessage.type === 'events' && Array.isArray(lastMessage.data)) {
          // Process in the next event loop
          setTimeout(() => {
            try {
              const eventData = lastMessage.data;
              
              // Check if this data has Sportybet odds
              const sportyEventsCount = eventData.filter((event: EventData) => 
                event.oddsData && 
                typeof event.oddsData === 'object' && 
                'sporty' in event.oddsData
              ).length;
              
              if (sportyEventsCount > 0) {
                // If it has Sportybet data, update our cache
                const filteredSportyEvents = eventData.filter((event: EventData) => 
                  event.oddsData && 
                  typeof event.oddsData === 'object' && 
                  'sporty' in event.oddsData
                );
                
                // Store minimal data
                const minimalSportyCache = filteredSportyEvents.map((event: EventData) => ({
                  id: event.id,
                  oddsData: {
                    sporty: event.oddsData.sporty
                  }
                }));
                
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(minimalSportyCache));
                setLocalCacheEvents(eventData);
              }
            } catch (error) {
              // Silent error handling
            }
          }, 0);
        }
      }
    }
  }, [lastMessage, queryClient]);

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
      // Silent error handling - no logging for better performance
    }
  }, []);

  // Combine server events with cached local events for Sportybet data - optimized for performance
  const mergeEvents = useCallback(() => {
    // If we have server data, use that as the base
    if (Array.isArray(serverEvents) && serverEvents.length > 0) {
      // PRIORITY CHANGE: Only use cached Sportybet data if the server doesn't have it
      // This ensures we always display fresh data when available
      if (localCacheEvents.length > 0) {
        // Create a shallow copy of the server events
        const mergedEvents = [...serverEvents];
        
        // Create a map of events by ID for quick lookup - faster than filtering arrays repeatedly
        const eventMap = new Map();
        mergedEvents.forEach(event => {
          eventMap.set(event.id, event);
        });
        
        // For each cached event that has Sportybet data, add it ONLY if server data is missing
        let usedCachedCount = 0;
        localCacheEvents.forEach(cachedEvent => {
          if (
            cachedEvent.oddsData && 
            typeof cachedEvent.oddsData === 'object' && 
            'sporty' in cachedEvent.oddsData &&
            cachedEvent.id
          ) {
            const serverEvent = eventMap.get(cachedEvent.id);
            if (serverEvent) {
              // Only use cached data if server doesn't have Sportybet data
              if (!serverEvent.oddsData || !serverEvent.oddsData.sporty) {
                // Ensure oddsData exists
                if (!serverEvent.oddsData) {
                  serverEvent.oddsData = {};
                }
                // Copy Sportybet odds from cache without deep clone (faster)
                serverEvent.oddsData.sporty = cachedEvent.oddsData.sporty;
                usedCachedCount++;
              }
            }
          }
        });
        
        // Show all events for now - we'll fix the filter logic later
        // Keep all events - don't filter by date/time
        // This ensures we don't accidentally filter out all events
        return mergedEvents;
        
        // Removed redundant code
      }
      
      // Show all events until we debug the date filtering
      return serverEvents;
    }

    // Show all cached events until we debug the date filtering
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
        // Store only Sportybet data to minimize memory usage
        const filteredSportyEvents = serverEvents.filter(event => 
          event.oddsData && 
          typeof event.oddsData === 'object' && 
          'sporty' in event.oddsData
        );
        
        // Store only essential data
        const minimalSportyCache = filteredSportyEvents.map(event => ({
          id: event.id,
          oddsData: {
            sporty: event.oddsData.sporty
          }
        }));
        
        // Store minimal data in localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(minimalSportyCache));
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
    testResilience,
    lastUpdateTime: lastUpdateTimestamp.current
  };
}