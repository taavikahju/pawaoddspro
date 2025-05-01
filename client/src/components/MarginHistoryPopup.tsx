import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface MarginHistoryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  bookmakers: string[];
}

const MarginHistoryPopup: React.FC<MarginHistoryPopupProps> = ({
  isOpen,
  onClose,
  eventId,
  eventName,
  bookmakers
}) => {
  // Query to load margin history for this event
  const { data, isLoading, error } = useQuery<any[]>({
    queryKey: [`/api/events/margins/${eventId}`],
    enabled: isOpen && !!eventId,
  });
  
  // Colors for each bookmaker
  const getBookmakerColor = (bookmakerCode: string) => {
    const colorMap: Record<string, string> = {
      'bp GH': '#3B82F6', // blue
      'bp KE': '#10B981', // green
      'sporty': '#F59E0B', // amber
      'betika KE': '#EF4444', // red
    };
    
    return colorMap[bookmakerCode] || '#6B7280'; // gray as fallback
  };
  
  // Process the data for the chart
  const [chartData, setChartData] = useState<any[]>([]);
  
  useEffect(() => {
    if (!data || !isOpen) return;
    
    try {
      // Get a set of all timestamps across all bookmakers
      const allTimestamps = new Set<string>();
      for (const record of data) {
        allTimestamps.add(record.timestamp);
      }
      
      // Create chart data points for each timestamp
      const processedData = Array.from(allTimestamps).map(timestamp => {
        const dataPoint: Record<string, any> = {
          timestamp
        };
        
        // Get a readable time format for display
        const date = new Date(timestamp);
        dataPoint.time = formatDistanceToNow(date, { addSuffix: true });
        
        // Add margin data for each bookmaker
        for (const record of data) {
          if (record.timestamp === timestamp) {
            dataPoint[record.bookmakerCode] = record.margin;
          }
        }
        
        return dataPoint;
      });
      
      // Sort by timestamp (newest first)
      processedData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setChartData(processedData.reverse()); // Reverse to show oldest -> newest for the chart
    } catch (error) {
      console.error('Error processing margin history data:', error);
    }
  }, [data, isOpen]);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Margin History for {eventName}</DialogTitle>
          <DialogDescription>
            This chart shows how the margin for this event has changed over time for each bookmaker.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isLoading && (
            <div className="h-60 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {error && (
            <div className="h-60 flex items-center justify-center">
              <p className="text-red-500">Failed to load margin history</p>
            </div>
          )}
          
          {!isLoading && !error && (!chartData || chartData.length === 0) && (
            <div className="h-60 flex items-center justify-center">
              <p className="text-gray-500">No margin history data available for this event</p>
            </div>
          )}
          
          {!isLoading && !error && chartData && chartData.length > 0 && (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    label={{ 
                      value: 'Margin %', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' }
                    }}
                    domain={['dataMin - 0.01', 'dataMax + 0.01']}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'Margin']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend />
                  
                  {bookmakers.map(bookmakerCode => 
                    chartData.some(dp => dp[bookmakerCode] !== undefined) && (
                      <Line
                        key={bookmakerCode}
                        type="monotone"
                        dataKey={bookmakerCode}
                        name={bookmakerCode}
                        stroke={getBookmakerColor(bookmakerCode)}
                        activeDot={{ r: 8 }}
                        isAnimationActive={true}
                        animationDuration={500}
                        strokeWidth={2}
                      />
                    )
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MarginHistoryPopup;