import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
// Import only the components we need to reduce bundle size
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CustomTooltip from './CustomTooltip';

interface OddsHistoryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  bookmakers: string[];
  oddsType: 'home' | 'draw' | 'away';
  // Force refresh to get latest history
  forceRefresh?: boolean;
}

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

export default function OddsHistoryPopup({
  isOpen,
  onClose,
  eventId,
  eventName,
  bookmakers,
  oddsType
}: OddsHistoryPopupProps) {
  
  // Get the display name for the odds type
  const oddsTypeDisplay = oddsType === 'home' ? 'Home' : oddsType === 'draw' ? 'Draw' : 'Away';
  
  // Fetch the current event to get real-time odds
  const { data: currentEvent, isLoading: isLoadingEvent, error: eventError } = useQuery({
    queryKey: ['/api/events', eventId],
    queryFn: async () => {
      try {
        console.log(`Fetching current event data for ID: ${eventId}`);
        const response = await axios.get(`/api/events/${eventId}`);
        console.log("Current event data response:", response.data);
        return response.data;
      } catch (error) {
        console.error("Error fetching current event:", error);
        throw error;
      }
    },
    enabled: isOpen && !!eventId, // Only fetch when dialog is open and eventId exists
    retry: 1, // Retry once if fail
    staleTime: 30000
  });
  
  // Fetch odds history for this event - optimized for lightweight loading
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/events', eventId, 'history', oddsType],
    queryFn: async () => {
      console.log(`Fetching odds history for event ID: ${eventId}, type: ${oddsType}`);
      
      // Only get last 10 entries to improve performance
      try {
        const response = await axios.get(`/api/events/${eventId}/history?limit=10`);
        console.log("Odds history response:", response.data);
        return response.data as OddsHistoryEntry[];
      } catch (error) {
        console.error("Error fetching odds history:", error);
        throw error;
      }
    },
    enabled: isOpen, // Only fetch when dialog is open
    staleTime: 30000 // Cache for 30 seconds to get more frequent updates
  });
  
  // Pre-process data for chart
  const chartData = React.useMemo(() => {
    if (!data) return [];
    
    // Group by timestamp (converts to DD MMM HH:MM)
    const dataByTimestamp = data.reduce((acc: Record<string, any>, entry) => {
      const date = new Date(entry.timestamp);
      
      // Format the date in UTC timezone - simplified format for popups (DD MMM HH:MM)
      const timeKey = date.toLocaleString('en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC'
      });
      
      if (!acc[timeKey]) {
        acc[timeKey] = { 
          timestamp: timeKey, 
          date: date
        };
      }
      
      // Get the odds for the selected type
      const odds = oddsType === 'home' 
        ? entry.homeOdds 
        : oddsType === 'draw' 
          ? entry.drawOdds 
          : entry.awayOdds;
      
      // Add odds for each bookmaker (parse to float since it may be stored as string)
      acc[timeKey][entry.bookmakerCode] = parseFloat(odds.toString());
      
      return acc;
    }, {});
    
    // Convert to array and sort by date
    return Object.values(dataByTimestamp).sort((a: any, b: any) => 
      a.date.getTime() - b.date.getTime()
    );
  }, [data, oddsType]);
  
  // Generate colors for each bookmaker
  const bookmakerColors: Record<string, string> = {
    'bp GH': '#FFA500', // Orange
    'bp KE': '#4CAF50', // Green
    'sporty': '#2196F3', // Blue
    'betika KE': '#E91E63', // Pink
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm font-medium">
            {oddsTypeDisplay} Odds: {eventName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="w-full min-h-[350px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[350px]">
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : error ? (
            <div className="text-red-500 p-2 text-center text-sm">
              Failed to load odds history data
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-gray-500 p-2 text-center text-sm">
              No odds history available for this event
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 15, bottom: 20 }}>
                <XAxis 
                  dataKey="timestamp" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={85} // Increase height to give more room for the date/time
                  tickFormatter={(tick) => {
                    // The tick is already in the format we want (DD MMM HH:MM)
                    return tick;
                  }}
                />
                <YAxis 
                  label={{ value: '', angle: -90, position: 'insideLeft' }}
                  domain={['dataMin - 0.1', 'dataMax + 0.1']}
                  width={30}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  content={<CustomTooltip dataPoints={chartData} />}
                />
                <Legend 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px', marginTop: '15px' }}
                  verticalAlign="bottom"
                />
                {bookmakers.map((bookmakerCode) => (
                  <Line
                    key={bookmakerCode}
                    type="monotone"
                    dataKey={bookmakerCode}
                    name={bookmakerCode}
                    stroke={bookmakerColors[bookmakerCode] || '#888888'}
                    strokeWidth={2}
                    dot={false} // Remove dots for better performance
                    activeDot={{ r: 4 }} // Smaller dots
                    connectNulls={false} // Do not connect across null/undefined values
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        
        {/* Display errors if they occur */}
        {eventError && (
          <div className="mt-2">
            <p className="text-xs text-red-500">
              Unable to load current event data. History is still available.
            </p>
          </div>
        )}
        
        {/* Add a comparison between current and historical odds */}
        {data && data.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">Current vs. Historical Odds Comparison</h3>
            {isLoadingEvent ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="border px-2 py-1 text-left">Bookmaker</th>
                      <th className="border px-2 py-1 text-center">Current Odds</th>
                      <th className="border px-2 py-1 text-center">Latest History</th>
                      <th className="border px-2 py-1 text-center">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                  {bookmakers.map(bookmakerCode => {
                    // Get the latest historical entry for this bookmaker
                    const latestHistoryEntry = [...data]
                      .filter(entry => entry.bookmakerCode === bookmakerCode)
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                    
                    // Get the current odds from the current event
                    // Special handling for Sportybet to ensure we get the most recent odds
                    let currentOdds = null;
                    if (bookmakerCode === 'sporty') {
                      console.log(`Getting Sportybet odds for ${eventName}`, {
                        event: currentEvent,
                        oddsData: currentEvent?.oddsData?.sporty,
                        oddsType
                      });
                      
                      // Make sure we extract the correct odds from Sportybet data
                      if (currentEvent?.oddsData?.sporty) {
                        currentOdds = oddsType === 'home' 
                          ? currentEvent.oddsData.sporty.home
                          : oddsType === 'draw'
                            ? currentEvent.oddsData.sporty.draw
                            : currentEvent.oddsData.sporty.away;
                      }
                    } else {
                      // Regular path for other bookmakers
                      currentOdds = currentEvent?.oddsData?.[bookmakerCode]?.[oddsType] || null;
                    }
                    
                    // Get the historical odds based on the selected type
                    const historyOdds = latestHistoryEntry 
                      ? (oddsType === 'home' 
                          ? latestHistoryEntry.homeOdds 
                          : oddsType === 'draw' 
                            ? latestHistoryEntry.drawOdds 
                            : latestHistoryEntry.awayOdds)
                      : null;
                    
                    // Calculate difference
                    const difference = currentOdds && historyOdds 
                      ? (parseFloat(currentOdds.toString()) - parseFloat(historyOdds.toString())).toFixed(2)
                      : null;
                    
                    // Determine color based on difference
                    const diffColor = difference 
                      ? (parseFloat(difference) > 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : parseFloat(difference) < 0 
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-600 dark:text-gray-400')
                      : 'text-gray-600 dark:text-gray-400';
                    
                    return (
                      <tr key={bookmakerCode} className="border-b">
                        <td className="border px-2 py-1 font-medium">{bookmakerCode}</td>
                        <td className="border px-2 py-1 text-center">
                          {currentOdds !== null ? currentOdds : '-'}
                        </td>
                        <td className="border px-2 py-1 text-center">
                          {historyOdds !== null ? historyOdds : '-'}
                        </td>
                        <td className={`border px-2 py-1 text-center ${diffColor}`}>
                          {difference !== null 
                            ? (parseFloat(difference) > 0 ? `+${difference}` : difference) 
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-1">
                Note: Differences may appear if odds were cached from previous scraper runs.
              </p>
            </div>
            )}
          </div>
        )}
        
        <DialogFooter className="pt-1">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs px-3">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}