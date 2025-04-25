import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from '@tanstack/react-query';
import HistoricalOddsChart from './HistoricalOddsChart';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { Event } from '../types/event';

interface OddsHistoryPopupProps {
  event: Event | null;
  open: boolean;
  onClose: () => void;
}

export default function OddsHistoryPopup({ event, open, onClose }: OddsHistoryPopupProps) {
  // Get bookmaker context for filtering
  const { selectedBookmakers } = useBookmakerContext();
  
  // Define BookmakerOddsData type to match the HistoricalOddsChart component's expected input
  interface BookmakerOddsData {
    homeOdds: Array<{ x: number, y: number }>;
    drawOdds: Array<{ x: number, y: number }>;
    awayOdds: Array<{ x: number, y: number }>;
    margins: Array<{ x: number, y: number }>;
  }

  // Query to fetch odds history - explicitly type the response
  const {
    data: historyData,
    isLoading,
    error
  } = useQuery<Record<string, BookmakerOddsData> | null>({
    queryKey: ['/api/events', event?.eventId, 'history'],
    queryFn: async () => {
      if (!event?.eventId) return null;
      
      const response = await fetch(`/api/events/${event.eventId}/history?format=chart`);
      if (!response.ok) {
        throw new Error('Failed to fetch historical odds data');
      }
      // Cast the JSON response to our expected type
      return await response.json() as Record<string, BookmakerOddsData>;
    },
    enabled: !!event?.eventId && open,
    refetchOnWindowFocus: false,
  });
  
  // Filter data to only show selected bookmakers
  const filteredData = historyData 
    ? Object.fromEntries(
        Object.entries(historyData).filter(([bookmakerCode]) => 
          selectedBookmakers.includes(bookmakerCode)
        )
      )
    : null;
  
  if (!event) return null;
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{event.name}</DialogTitle>
          <DialogDescription>
            {event.country} - {event.tournament}
            {event.startTime && (
              <span className="ml-2">
                • {new Date(event.startTime).toLocaleString()}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {error ? (
            <div className="text-center p-6 text-destructive">
              <p>Error loading historical odds data.</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : 'An unknown error occurred'}
              </p>
            </div>
          ) : (
            <HistoricalOddsChart 
              data={filteredData} 
              isLoading={isLoading} 
              eventName={event.name}
            />
          )}
          
          {(!isLoading && filteredData && Object.keys(filteredData).length === 0) && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <p className="text-center text-sm text-muted-foreground">
                No data available for the selected bookmakers. Please select at least one bookmaker that has odds for this event.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}