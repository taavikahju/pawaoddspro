import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Loader2 } from 'lucide-react';

// Type for history entry
interface OddsHistoryEntry {
  id: number;
  eventId: string;
  externalId: string;
  bookmakerCode: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  margin: number;
  timestamp: string;
}

// Props interface
interface HistoricalOddsChartProps {
  historyData: OddsHistoryEntry[];
  selectedBookmakers: string[];
  oddsType: 'homeOdds' | 'drawOdds' | 'awayOdds' | 'margin';
  title: string;
  isPercentage?: boolean;
}

interface ChartDataPoint {
  timestamp: string;
  [key: string]: any; // For bookmaker codes as keys
}

// The defined colors for each bookmaker to maintain consistency
const BOOKMAKER_COLORS: Record<string, string> = {
  'betika KE': '#1E88E5',
  'sporty': '#43A047',
  'bp KE': '#FFB300',
  'bp GH': '#E53935',
  'example': '#8E24AA'
};

// Fallback colors for any bookmaker not in the predefined list
const FALLBACK_COLORS = [
  '#2196F3', '#4CAF50', '#FFC107', '#F44336', '#9C27B0',
  '#3F51B5', '#009688', '#FF9800', '#795548', '#607D8B'
];

export default function HistoricalOddsChart({
  historyData,
  selectedBookmakers,
  oddsType,
  title,
  isPercentage = false
}: HistoricalOddsChartProps) {
  
  // Process data for the chart
  const chartData = useMemo(() => {
    if (!historyData || historyData.length === 0) return [];
    
    // Group by timestamp and bookmaker for easy display
    const groupedByTime: Record<string, ChartDataPoint> = {};
    
    historyData.forEach(entry => {
      // Only process if the bookmaker is selected
      if (!selectedBookmakers.includes(entry.bookmakerCode)) return;
      
      // Format timestamp for display
      const timestamp = new Date(entry.timestamp);
      const timeKey = timestamp.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      // Initialize time point if it doesn't exist
      if (!groupedByTime[timeKey]) {
        groupedByTime[timeKey] = { 
          timestamp: timeKey,
          // Store date object as a custom property for sorting later
          _date: timestamp.getTime()
        };
      }
      
      // Add the odds value for this bookmaker at this time
      groupedByTime[timeKey][entry.bookmakerCode] = entry[oddsType];
    });
    
    // Convert to array and sort by timestamp
    return Object.values(groupedByTime)
      .sort((a, b) => a._date - b._date);
  }, [historyData, selectedBookmakers, oddsType]);
  
  // Determine bookmakers to show in the chart
  const bookmakersToShow = useMemo(() => {
    // Get unique bookmaker codes that exist in the data
    const availableBookmakers = new Set<string>();
    
    historyData.forEach(entry => {
      if (selectedBookmakers.includes(entry.bookmakerCode)) {
        availableBookmakers.add(entry.bookmakerCode);
      }
    });
    
    return [...availableBookmakers]; // Convert Set to Array using spread operator
  }, [historyData, selectedBookmakers]);
  
  // Get the color for a bookmaker
  const getBookmakerColor = (bookmaker: string, index: number) => {
    return BOOKMAKER_COLORS[bookmaker] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  };
  
  // Format the value for display in tooltip
  const formatValue = (value: number) => {
    if (isPercentage) {
      return `${value.toFixed(2)}%`;
    }
    return value.toFixed(2);
  };

  // If no data or no bookmakers to show
  if (chartData.length === 0 || bookmakersToShow.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No historical data available for the selected bookmakers
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-medium mb-4">{title}</h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              height={60}
              tickFormatter={(tick) => {
                return tick; // Display MM/DD HH:MM
              }}
            />
            <YAxis 
              domain={['auto', 'auto']}
              width={60}
              tickFormatter={(value) => isPercentage ? `${value}%` : value}
            />
            <Tooltip
              formatter={(value: number) => [formatValue(value), '']}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend verticalAlign="top" height={36} />
            {bookmakersToShow.map((bookmaker, index) => (
              <Line
                key={bookmaker}
                type="monotone"
                dataKey={bookmaker}
                name={bookmaker}
                stroke={getBookmakerColor(bookmaker, index)}
                activeDot={{ r: 6 }}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}