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

interface MarginHistoryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  bookmakers: string[];
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

export default function MarginHistoryPopup({
  isOpen,
  onClose,
  eventId,
  eventName,
  bookmakers
}: MarginHistoryPopupProps) {
  
  // Fetch odds history for this event - optimized for lightweight loading
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/events', eventId, 'history'],
    queryFn: async () => {
      // Only get last 10 entries to improve performance
      const response = await axios.get(`/api/events/${eventId}/history?limit=10`);
      return response.data as OddsHistoryEntry[];
    },
    enabled: isOpen, // Only fetch when dialog is open
    staleTime: 60000 // Cache for 1 minute
  });
  
  // Pre-process data for chart
  const chartData = React.useMemo(() => {
    if (!data) return [];
    
    // Group by timestamp (converts to YYYY-MM-DD HH:MM)
    const dataByTimestamp = data.reduce((acc: Record<string, any>, entry) => {
      const date = new Date(entry.timestamp);
      // Format the date in UTC timezone
      const timeKey = date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC'
      }) + ' UTC';
      
      if (!acc[timeKey]) {
        acc[timeKey] = { 
          timestamp: timeKey, 
          date: date
        };
      }
      
      // Add margin for each bookmaker (parse to float since it may be stored as string)
      acc[timeKey][entry.bookmakerCode] = parseFloat(entry.margin.toString());
      
      return acc;
    }, {});
    
    // Convert to array and sort by date
    return Object.values(dataByTimestamp).sort((a: any, b: any) => 
      a.date.getTime() - b.date.getTime()
    );
  }, [data]);
  
  // Generate colors for each bookmaker - use consistent colors for all charts
  const bookmakerColors: Record<string, string> = {
    'bp GH': '#FF9800', // Orange
    'bp KE': '#4CAF50', // Green
    'sporty': '#2196F3', // Blue
    'betika KE': '#E91E63', // Pink
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm font-medium">
            {eventName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="w-full min-h-[350px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[350px]">
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : error ? (
            <div className="text-red-500 p-2 text-center text-sm">
              Failed to load margin history data
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-gray-500 p-2 text-center text-sm">
              No margin history available for this event
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
                    // Show date and time
                    const parts = tick.split(' ');
                    if (parts.length >= 2) {
                      return `${parts[0].slice(5)} ${parts[1]}`; // Format: MM/DD HH:MM (omit year for space)
                    }
                    return tick;
                  }}
                />
                <YAxis 
                  label={{ value: '%', angle: -90, position: 'insideLeft' }}
                  domain={[0, 'dataMax + 1']}
                  width={30}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [`${Number(value).toFixed(2)}%`, name]}
                  labelFormatter={(label) => `Date/Time: ${label}`}
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
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        
        <DialogFooter className="pt-1">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs px-3">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}