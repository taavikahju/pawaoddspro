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
    onSuccess: handleSuccess,
    onError: handleError
  });

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
  const mergeEvents = () => {
    // If we have server data, use that as the base
    if (Array.isArray(serverEvents) && serverEvents.length > 0) {
      // Check if server events have Sportybet data
      const hasSportyBetData = serverEvents.some(event => 
        event.oddsData && 
        typeof event.oddsData === 'object' && 
        'sporty' in event.oddsData
      );

      // If server data has Sportybet odds, use server data directly
      if (hasSportyBetData) {
        return serverEvents;
      }

      // If no Sportybet data in server response, check cached data
      if (localCacheEvents.length > 0) {
        console.log('No Sportybet data in server response, merging with cached data');

        // Create a map of events by ID for quick lookup
        const eventMap = new Map(serverEvents.map(event => [event.id, event]));

        // For each cached event that has Sportybet data, add the Sportybet data to server events
        localCacheEvents.forEach(cachedEvent => {
          if (
            cachedEvent.oddsData && 
            typeof cachedEvent.oddsData === 'object' && 
            'sporty' in cachedEvent.oddsData
          ) {
            const serverEvent = eventMap.get(cachedEvent.id);
            if (serverEvent) {
              // Add Sportybet odds from cache
              if (!serverEvent.oddsData.sporty) {
                if (!serverEvent.oddsData) {
                  serverEvent.oddsData = {};
                }
                serverEvent.oddsData.sporty = cachedEvent.oddsData.sporty;
              }
            }
          }
        });

        return serverEvents;
      }

      return serverEvents;
    }

    // If no server data, use cached events
    return localCacheEvents;
  };

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

  return {
    events,
    isLoading,
    error,
    isError
  };
}