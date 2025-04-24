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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
// Import only the components we need to reduce bundle size
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface OddsHistoryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  bookmakers: string[];
  oddsType: 'home' | 'draw' | 'away';
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
  const [activeTab, setActiveTab] = useState<string>('chart');
  
  // Get the display name for the odds type
  const oddsTypeDisplay = oddsType === 'home' ? 'Home' : oddsType === 'draw' ? 'Draw' : 'Away';
  
  // Fetch odds history for this event - optimized for lightweight loading
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/events', eventId, 'history', oddsType],
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
      const timeKey = date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
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
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start mb-1 h-8">
            <TabsTrigger value="chart" className="text-xs h-7 px-3">Chart</TabsTrigger>
            <TabsTrigger value="table" className="text-xs h-7 px-3">Table</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart" className="min-h-[350px]">
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
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 15, bottom: 20 }}>
                  <XAxis 
                    dataKey="timestamp" 
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={70}
                    tickFormatter={(tick) => tick.split(' ')[1]} // Show only time for brevity
                  />
                  <YAxis 
                    label={{ value: '', angle: -90, position: 'insideLeft' }}
                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                    width={30}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [`${Number(value).toFixed(2)}`, name]}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend 
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', marginTop: '5px' }}
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
          </TabsContent>
          
          <TabsContent value="table" className="min-h-[350px]">
            {isLoading ? (
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : error ? (
              <div className="text-red-500 p-2 text-center text-sm">
                Failed to load odds history data
              </div>
            ) : !data || data.length === 0 ? (
              <div className="text-gray-500 p-2 text-center text-sm">
                No odds history available for this event
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left text-sm">Time</th>
                      <th className="p-2 text-left text-sm">Bookmaker</th>
                      <th className="p-2 text-right text-sm">{oddsTypeDisplay} Odds</th>
                      <th className="p-2 text-right text-sm">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 10).map((entry, index, array) => { // Limit to 10 rows for faster rendering
                      // Get odds based on the type
                      const odds = oddsType === 'home' 
                        ? entry.homeOdds 
                        : oddsType === 'draw' 
                          ? entry.drawOdds 
                          : entry.awayOdds;
                      
                      // Calculate change from previous odds for the same bookmaker
                      let change = 0;
                      let prevEntry;
                      
                      if (index < array.length - 1) {
                        prevEntry = array.slice(index + 1).find(e => e.bookmakerCode === entry.bookmakerCode);
                        if (prevEntry) {
                          const prevOdds = oddsType === 'home' 
                            ? prevEntry.homeOdds 
                            : oddsType === 'draw' 
                              ? prevEntry.drawOdds 
                              : prevEntry.awayOdds;
                          change = parseFloat(odds.toString()) - parseFloat(prevOdds.toString());
                        }
                      }
                      
                      return (
                        <tr key={entry.id} className="border-b border-gray-200 hover:bg-muted/50">
                          <td className="p-1.5 text-left text-xs">
                            {new Date(entry.timestamp).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })}
                          </td>
                          <td className="p-1.5 text-left text-xs font-medium">{entry.bookmakerCode}</td>
                          <td className="p-1.5 text-right text-xs">{parseFloat(odds.toString()).toFixed(2)}</td>
                          <td className={`p-1.5 text-right text-xs ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : ''}`}>
                            {change !== 0 ? (change > 0 ? '+' : '') + change.toFixed(2) : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="pt-1">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs px-3">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}