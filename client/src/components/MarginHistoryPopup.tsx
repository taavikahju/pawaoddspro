import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface MarginHistoryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  bookmakers: string[];
}

type MarginHistoryEntry = {
  eventId: string;
  bookmakerCode: string;
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
  // Fetch margin history for this event
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/events/margins/${eventId}`],
    queryFn: async () => {
      const response = await axios.get(`/api/events/margins/${eventId}`);
      return response.data as MarginHistoryEntry[];
    },
    enabled: isOpen && !!eventId,
    staleTime: 60000 // Cache for 1 minute
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
      
      // Add margin for each bookmaker (parse to float)
      // The margin is already calculated on the server as (1/home + 1/draw + 1/away - 1)
      // Convert to percentage format for display
      const marginValue = parseFloat(entry.margin.toString()) * 100; // Convert to percentage
      acc[timeKey][entry.bookmakerCode] = marginValue;
      
      return acc;
    }, {});
    
    // Convert to array and sort by date
    return Object.values(dataByTimestamp).sort((a: any, b: any) => 
      a.date.getTime() - b.date.getTime()
    );
  }, [data]);
  
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
            Margin History: {eventName}
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
                />
                <YAxis 
                  label={{ 
                    value: 'Margin %', 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  width={40}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [`${Number(value).toFixed(2)}%`, name]}
                  labelFormatter={(label) => {
                    // Find the data point for this label to get the original timestamp
                    const dataPoint = chartData.find(dp => dp.timestamp === label);
                    if (dataPoint && dataPoint.date) {
                      // Format the full date and time
                      return `Date/Time: ${label}\nFull Timestamp: ${dataPoint.date.toISOString()}`;
                    }
                    return `Date/Time: ${label}`;
                  }}
                  contentStyle={{ whiteSpace: 'pre-line', fontSize: '12px' }}
                />
                <Legend 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px', marginTop: '15px' }}
                  verticalAlign="bottom"
                />
                {bookmakers.map((bookmakerCode) => (
                  chartData.some(dp => dp[bookmakerCode] !== undefined) && (
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
                  )
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