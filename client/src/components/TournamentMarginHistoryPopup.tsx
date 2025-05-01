import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { format } from 'date-fns';

interface MarginHistoryItem {
  id: number;
  bookmakerCode: string;
  countryName: string;
  tournament: string;
  averageMargin: string;
  eventCount: number;
  timestamp: string;
}

interface TournamentMarginHistoryPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentName: string;
  bookmakerCode: string;
  bookmakerName: string;
  countryName?: string; // Make country optional
}

export default function TournamentMarginHistoryPopup({
  open,
  onOpenChange,
  tournamentName,
  bookmakerCode,
  bookmakerName,
  countryName
}: TournamentMarginHistoryPopupProps) {
  // Use the original bookmaker code, no need to convert
  // Fetch margin history data
  const { data, isLoading, error } = useQuery<MarginHistoryItem[]>({
    queryKey: ['/api/tournaments/margins/history', tournamentName, bookmakerCode, countryName],
    queryFn: async () => {
      // Build the URL with query parameters, including country if provided
      let url = `/api/tournaments/margins/history?tournament=${encodeURIComponent(tournamentName)}&bookmaker=${encodeURIComponent(bookmakerCode)}`;
      
      // Add country filter if provided
      if (countryName) {
        url += `&country=${encodeURIComponent(countryName)}`;
      }
      
      const response = await axios.get(url);
      return response.data;
    },
    enabled: open,
    staleTime: 60000 // Cache for 1 minute
  });

  // Process data for the chart
  const chartData = React.useMemo(() => {
    if (!data) return [];
    
    return data.map(item => {
      const date = new Date(item.timestamp);
      
      // Format date for display (DD MMM HH:MM)
      const formattedDate = date.toLocaleString('en-US', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC'
      });
      
      return {
        timestamp: formattedDate,
        margin: parseFloat(item.averageMargin) * 100, // Convert decimal to percentage (e.g., 0.0364 → 3.64%)
        eventCount: item.eventCount,
        date: date // Keep original date for sorting
      };
    }).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data]);

  // Get color based on margin value
  const getMarginColor = (margin: number): string => {
    if (margin < 5.0) return '#16a34a'; // green-600
    if (margin < 7.5) return '#65a30d'; // lime-600
    if (margin < 10.0) return '#d97706'; // amber-600
    if (margin < 12.5) return '#ea580c'; // orange-600
    return '#dc2626'; // red-600
  };

  // Get chart color based on average margin
  const chartColor = React.useMemo(() => {
    if (!chartData.length) return '#16a34a';
    const avgMargin = chartData.reduce((sum, item) => sum + item.margin, 0) / chartData.length;
    return getMarginColor(avgMargin);
  }, [chartData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm font-medium">
            Margin History: {tournamentName}{countryName ? ` (${countryName})` : ''} - {bookmakerName}
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
              No margin history available for this tournament
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart 
                data={chartData} 
                margin={{ top: 5, right: 20, left: 15, bottom: 20 }}
              >
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
                  formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Margin']}
                  labelFormatter={(label) => `Date/Time: ${label}`}
                />
                <Legend 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px', marginTop: '15px' }}
                  verticalAlign="bottom"
                />
                <Line
                  type="monotone"
                  dataKey="margin"
                  name="Tournament Margin"
                  stroke={chartColor}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false} // Do not connect across null/undefined values
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        
        <div className="text-xs text-gray-500 pt-3 pb-1 text-center">
          {chartData.length > 0 && (
            <span>
              Based on an average of {Math.round(chartData.reduce((sum, item) => sum + item.eventCount, 0) / chartData.length)} events per data point
            </span>
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