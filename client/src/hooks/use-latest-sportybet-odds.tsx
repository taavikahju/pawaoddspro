import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useCallback } from 'react';

// Type definition for odds history entry
type OddsHistoryEntry = {
  id: number;
  eventId: string;
  externalId: string;
  bookmakerCode: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  margin: number;
  timestamp: string;
};

// Type for stored odds
export type LatestOdds = {
  home: number;
  draw: number;
  away: number;
  timestamp: string;
};

/**
 * This hook fetches the latest Sportybet odds from history for a specific event
 * It's used to overcome caching issues with the Sportybet odds in the table
 */
export function useLatestSportybetOdds(eventId: string) {
  // Function to fetch the latest odds history
  const fetchLatestOdds = useCallback(async (): Promise<LatestOdds | null> => {
    if (!eventId) {
      return null;
    }

    try {
      // Fetch odds history for this event
      const response = await axios.get(`/api/events/${eventId}/history?bookmaker=sporty`);
      const history = response.data as OddsHistoryEntry[];
      
      // If we have history, sort by timestamp and get the latest
      if (history && history.length > 0) {
        // Sort by timestamp (newest first)
        const sortedHistory = [...history].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        // Take the latest entry
        const latestEntry = sortedHistory[0];
        
        // Return the odds
        return {
          home: latestEntry.homeOdds,
          draw: latestEntry.drawOdds,
          away: latestEntry.awayOdds,
          timestamp: latestEntry.timestamp
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching latest Sportybet odds:', error);
      return null;
    }
  }, [eventId]);
  
  // Use React Query to fetch the results with minimal caching 
  const { data, isLoading, error } = useQuery({
    queryKey: ['latestSportybetOdds', eventId],
    queryFn: fetchLatestOdds,
    enabled: !!eventId, // Only run if we have an event ID
    staleTime: 1000, // Cache for just 1 second to ensure fresh data
    gcTime: 5000, // Only keep in cache for 5 seconds (renamed from cacheTime in v5)
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true // Always refetch when component mounts
  });
  
  return {
    latestOdds: data,
    isLoading,
    error
  };
}