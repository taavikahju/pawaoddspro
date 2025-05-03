import React, { useEffect } from 'react';
import { useLatestSportybetOdds } from '@/hooks/use-latest-sportybet-odds';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Declare global cache
declare global {
  interface Window {
    __LATEST_SPORTYBET_ODDS_CACHE?: Record<string, {
      home: number;
      draw: number;
      away: number;
      timestamp: string;
    }>;
  }
}

interface SportybetOddsProps {
  event: any;
  oddsType: 'home' | 'draw' | 'away';
  highlightType: 'highest' | 'lowest' | 'none';
  onClick: () => void;
}

export default function SportybetOdds({ event, oddsType, highlightType, onClick }: SportybetOddsProps) {
  // Get event ID with fallback options
  const eventId = event.eventId || event.id?.toString() || event.externalId || '';
  
  // Fetch the latest odds for this event
  const { latestOdds, isLoading } = useLatestSportybetOdds(eventId);
  
  // Get the current odds from the event data or default to 0
  const currentOdds = event.oddsData?.['sporty']?.[oddsType] || 0;
  
  // Check if we have cached odds for this event
  const cachedOdds = window.__LATEST_SPORTYBET_ODDS_CACHE?.[eventId]?.[oddsType];
  
  // Get the correct odds to display (latest from history if available, otherwise cached, otherwise current)
  const displayOdds = latestOdds ? latestOdds[oddsType] : (cachedOdds || currentOdds);
  
  // Update the global cache when we receive latest odds
  useEffect(() => {
    if (latestOdds && eventId) {
      // Initialize the cache if it doesn't exist
      if (!window.__LATEST_SPORTYBET_ODDS_CACHE) {
        window.__LATEST_SPORTYBET_ODDS_CACHE = {};
      }
      
      // Update the cache with the latest odds
      window.__LATEST_SPORTYBET_ODDS_CACHE[eventId] = latestOdds;
    }
  }, [latestOdds, eventId]);
  
  // Determine the appropriate highlight class based on the highlight type
  const highlightClass = 
    highlightType === 'highest' 
      ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" 
      : highlightType === 'lowest'
        ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
        : "bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  
  return (
    <span className={cn("text-sm font-medium px-1 py-0.5 rounded", highlightClass)}>
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin inline" />
      ) : displayOdds ? (
        <button 
          className="hover:underline focus:outline-none"
          onClick={onClick}
        >
          {Number(displayOdds).toFixed(2)}
        </button>
      ) : '-'}
    </span>
  );
}