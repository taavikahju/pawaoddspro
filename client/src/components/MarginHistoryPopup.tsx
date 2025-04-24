import React, { useState, useEffect } from 'react';
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  const [activeTab, setActiveTab] = useState<string>('chart');
  
  // Fetch odds history for this event
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/events', eventId, 'history'],
    queryFn: async () => {
      const response = await axios.get(`/api/events/${eventId}/history`);
      return response.data as OddsHistoryEntry[];
    },
    enabled: isOpen, // Only fetch when dialog is open
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
      
      // Add margin for each bookmaker
      acc[timeKey][entry.bookmakerCode] = entry.margin;
      
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
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Margin History for: {eventName}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start mb-4">
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart" className="min-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <Skeleton className="h-[350px] w-full" />
              </div>
            ) : error ? (
              <div className="text-red-500 p-4 text-center">
                Failed to load margin history data
              </div>
            ) : chartData.length === 0 ? (
              <div className="text-gray-500 p-4 text-center">
                No margin history available for this event
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    label={{ value: 'Margin %', angle: -90, position: 'insideLeft' }}
                    domain={[0, 'dataMax + 1']}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${Number(value).toFixed(2)}%`, '']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend />
                  {bookmakers.map((bookmakerCode) => (
                    <Line
                      key={bookmakerCode}
                      type="monotone"
                      dataKey={bookmakerCode}
                      name={bookmakerCode}
                      stroke={bookmakerColors[bookmakerCode] || '#' + Math.floor(Math.random() * 16777215).toString(16)}
                      activeDot={{ r: 8 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
          
          <TabsContent value="table" className="min-h-[400px]">
            {isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : error ? (
              <div className="text-red-500 p-4 text-center">
                Failed to load margin history data
              </div>
            ) : !data || data.length === 0 ? (
              <div className="text-gray-500 p-4 text-center">
                No margin history available for this event
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Bookmaker</th>
                      <th className="p-2 text-right">Home</th>
                      <th className="p-2 text-right">Draw</th>
                      <th className="p-2 text-right">Away</th>
                      <th className="p-2 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-200 hover:bg-muted/50">
                        <td className="p-2 text-left">
                          {new Date(entry.timestamp).toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </td>
                        <td className="p-2 text-left font-medium">{entry.bookmakerCode}</td>
                        <td className="p-2 text-right">{entry.homeOdds.toFixed(2)}</td>
                        <td className="p-2 text-right">{entry.drawOdds.toFixed(2)}</td>
                        <td className="p-2 text-right">{entry.awayOdds.toFixed(2)}</td>
                        <td 
                          className={`p-2 text-right font-medium ${
                            entry.margin < 5 
                              ? 'text-green-600' 
                              : entry.margin < 7.5 
                              ? 'text-lime-600' 
                              : entry.margin < 10 
                              ? 'text-amber-600'
                              : entry.margin < 12.5
                              ? 'text-orange-600'
                              : 'text-red-600'
                          }`}
                        >
                          {entry.margin.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}