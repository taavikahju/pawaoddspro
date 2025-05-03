import React from 'react';
import { useLatestSportybetOdds } from '@/hooks/use-latest-sportybet-odds';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SportybetOddsProps {
  event: any;
  oddsType: 'home' | 'draw' | 'away';
  highlightType: 'highest' | 'lowest' | 'none';
  onClick: () => void;
}

export default function SportybetOdds({ event, oddsType, highlightType, onClick }: SportybetOddsProps) {
  // Get event ID with fallback options
  const eventId = event.eventId || event.id?.toString() || event.externalId || '';
  
  // Fetch the latest odds for this event from history
  const { latestOdds, isLoading } = useLatestSportybetOdds(eventId);
  
  // Get the current odds from the event data as fallback
  const currentOdds = event.oddsData?.['sporty']?.[oddsType] || 0;
  
  // Get the correct odds to display (latest from history if available, otherwise current)
  const displayOdds = latestOdds ? latestOdds[oddsType] : currentOdds;
  
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