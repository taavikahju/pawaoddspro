import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery } from '@tanstack/react-query';
import { Line } from 'recharts';
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface MarginHistoryData {
  id: number;
  tournamentName: string;
  bookmakerCode: string;
  countryName: string | null;
  averageMargin: string;
  eventCount: number;
  timestamp: string;
}

interface MarginHistoryPopupProps {
  tournamentName: string;
  isOpen: boolean;
  onClose: () => void;
}

const MarginHistoryPopup: React.FC<MarginHistoryPopupProps> = ({ 
  tournamentName,
  isOpen, 
  onClose 
}) => {
  const [selectedBookmaker, setSelectedBookmaker] = useState<string | undefined>(undefined);
  
  // Reset selected bookmaker when popup opens with new tournament
  useEffect(() => {
    if (isOpen) {
      setSelectedBookmaker(undefined);
    }
  }, [isOpen, tournamentName]);
  
  // Fetch margin history for the tournament
  const { data: marginHistory, isLoading } = useQuery<MarginHistoryData[]>({
    queryKey: ['/api/tournaments/margins', tournamentName, selectedBookmaker],
    queryFn: async () => {
      const params = new URLSearchParams({
        tournament: tournamentName
      });
      
      if (selectedBookmaker) {
        params.append('bookmaker', selectedBookmaker);
      }
      
      const response = await fetch(`/api/tournaments/margins?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch margin history');
      }
      return response.json();
    },
    enabled: isOpen && !!tournamentName
  });
  
  // Extract unique bookmakers from the data
  const uniqueBookmakers = marginHistory
    ? [...new Set(marginHistory.map(item => item.bookmakerCode))]
    : [];
  
  // Process data for the chart
  const chartData = marginHistory?.map(item => ({
    timestamp: format(new Date(item.timestamp), 'dd MMM HH:mm'),
    margin: parseFloat(item.averageMargin),
    bookmaker: item.bookmakerCode,
    eventCount: item.eventCount
  })) || [];
  
  // Group data by bookmaker for multiple lines
  const bookmakerData = React.useMemo(() => {
    const dataMap = new Map<string, any[]>();
    
    if (marginHistory) {
      // If a specific bookmaker is selected, only show that one
      if (selectedBookmaker) {
        const filtered = marginHistory
          .filter(item => item.bookmakerCode === selectedBookmaker)
          .map(item => ({
            timestamp: format(new Date(item.timestamp), 'dd MMM HH:mm'),
            margin: parseFloat(item.averageMargin),
            eventCount: item.eventCount
          }));
          
        if (filtered.length > 0) {
          dataMap.set(selectedBookmaker, filtered);
        }
      } else {
        // Group by bookmaker
        marginHistory.forEach(item => {
          const key = item.bookmakerCode;
          if (!dataMap.has(key)) {
            dataMap.set(key, []);
          }
          
          dataMap.get(key)!.push({
            timestamp: format(new Date(item.timestamp), 'dd MMM HH:mm'),
            margin: parseFloat(item.averageMargin),
            eventCount: item.eventCount
          });
        });
      }
    }
    
    return dataMap;
  }, [marginHistory, selectedBookmaker]);
  
  // Determine if we have multiple bookmakers to show
  const hasMultipleBookmakers = uniqueBookmakers.length > 1;
  
  // Merged data for a single line chart with timestamps
  const mergedData = React.useMemo(() => {
    if (!hasMultipleBookmakers || selectedBookmaker) {
      return chartData;
    }
    
    // Combine all timestamps
    const timestampMap = new Map<string, any>();
    
    chartData.forEach(item => {
      if (!timestampMap.has(item.timestamp)) {
        timestampMap.set(item.timestamp, { timestamp: item.timestamp });
      }
      
      const entry = timestampMap.get(item.timestamp);
      entry[item.bookmaker] = item.margin;
    });
    
    return Array.from(timestampMap.values());
  }, [chartData, hasMultipleBookmakers, selectedBookmaker]);
  
  // Colors for the bookmakers
  const colors = ['#4f46e5', '#16a34a', '#ea580c', '#dc2626', '#9333ea', '#0891b2'];
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Tournament Margin History: {tournamentName}
          </DialogTitle>
          <DialogDescription>
            Average margin history over time for this tournament.
          </DialogDescription>
        </DialogHeader>

        {hasMultipleBookmakers && (
          <div className="mb-4">
            <Label htmlFor="bookmaker-select">Select Bookmaker</Label>
            <Select 
              value={selectedBookmaker} 
              onValueChange={setSelectedBookmaker}
            >
              <SelectTrigger id="bookmaker-select">
                <SelectValue placeholder="All Bookmakers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={undefined}>All Bookmakers</SelectItem>
                {uniqueBookmakers.map(bookie => (
                  <SelectItem key={bookie} value={bookie}>
                    {bookie}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : marginHistory && marginHistory.length > 0 ? (
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={selectedBookmaker ? chartData : mergedData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  angle={-45} 
                  textAnchor="end" 
                  height={70}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={['auto', 'auto']}
                  label={{ 
                    value: 'Margin %', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' } 
                  }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Margin']}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Legend />
                
                {/* If a specific bookmaker is selected or there's only one */}
                {(selectedBookmaker || !hasMultipleBookmakers) && (
                  <Line 
                    type="monotone" 
                    dataKey="margin" 
                    name={selectedBookmaker || uniqueBookmakers[0]} 
                    stroke={colors[0]} 
                    activeDot={{ r: 8 }} 
                  />
                )}
                
                {/* If no specific bookmaker is selected and we have multiple */}
                {!selectedBookmaker && hasMultipleBookmakers && (
                  Array.from(bookmakerData.entries()).map(([bookmaker, data], index) => (
                    <Line
                      key={bookmaker}
                      type="monotone"
                      dataKey={bookmaker}
                      name={bookmaker}
                      stroke={colors[index % colors.length]}
                      activeDot={{ r: 6 }}
                    />
                  ))
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex justify-center items-center h-64 text-muted-foreground">
            No margin history data available for this tournament.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MarginHistoryPopup;