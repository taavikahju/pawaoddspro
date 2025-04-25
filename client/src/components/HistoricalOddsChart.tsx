import React, { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

// Type for odds history data from API
interface BookmakerOddsData {
  homeOdds: Array<{ x: number, y: number }>;
  drawOdds: Array<{ x: number, y: number }>;
  awayOdds: Array<{ x: number, y: number }>;
  margins: Array<{ x: number, y: number }>;
}

interface HistoricalOddsChartProps {
  data: Record<string, BookmakerOddsData> | null;
  isLoading: boolean;
  eventName: string;
}

// Custom tooltip for the chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border p-2 rounded-md shadow-md">
        <p className="text-xs font-medium">{format(new Date(label), 'PPp')}</p>
        {payload.map((entry: any, index: number) => (
          <p 
            key={`item-${index}`} 
            className="text-sm" 
            style={{ color: entry.color }}
          >
            <span className="font-medium">{entry.name}: </span>
            {entry.value.toFixed(2)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function HistoricalOddsChart({ 
  data, 
  isLoading, 
  eventName 
}: HistoricalOddsChartProps) {
  const [tab, setTab] = useState("home");
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <h3 className="text-lg font-medium mb-2">No historical data available</h3>
        <p className="text-muted-foreground">
          This event doesn't have any historical odds data recorded yet.
        </p>
      </div>
    );
  }
  
  // Get all bookmakers for legend
  const bookmakers = Object.keys(data);
  
  // Get the data for the current tab
  const getDataForTab = () => {
    // Create a common timeline with all timestamps from all bookmakers
    const allTimestamps = new Set<number>();
    
    bookmakers.forEach(bookmaker => {
      let oddsArray: Array<{ x: number, y: number }> = [];
      
      if (tab === 'home') {
        oddsArray = data[bookmaker].homeOdds;
      } else if (tab === 'draw') {
        oddsArray = data[bookmaker].drawOdds;
      } else if (tab === 'away') {
        oddsArray = data[bookmaker].awayOdds;
      } else if (tab === 'margin') {
        oddsArray = data[bookmaker].margins;
      }
      
      oddsArray.forEach(entry => {
        allTimestamps.add(entry.x);
      });
    });
    
    // Convert set to sorted array
    const timestamps = Array.from(allTimestamps).sort();
    
    // Create data points for each timestamp
    return timestamps.map(timestamp => {
      const dataPoint: any = {
        timestamp,
      };
      
      bookmakers.forEach(bookmaker => {
        let oddsArray: Array<{ x: number, y: number }> = [];
        
        if (tab === 'home') {
          oddsArray = data[bookmaker].homeOdds;
        } else if (tab === 'draw') {
          oddsArray = data[bookmaker].drawOdds;
        } else if (tab === 'away') {
          oddsArray = data[bookmaker].awayOdds;
        } else if (tab === 'margin') {
          oddsArray = data[bookmaker].margins;
        }
        
        const entry = oddsArray.find(e => e.x === timestamp);
        dataPoint[bookmaker] = entry ? entry.y : null;
      });
      
      return dataPoint;
    });
  };
  
  // Generate chart data
  const chartData = getDataForTab();
  
  // Color mapping for bookmakers
  const colors = [
    "#3B82F6", // blue-500
    "#EF4444", // red-500
    "#10B981", // emerald-500
    "#F59E0B", // amber-500
    "#8B5CF6", // violet-500
    "#EC4899", // pink-500
    "#6366F1", // indigo-500
    "#14B8A6", // teal-500
  ];
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">{eventName}</CardTitle>
        <CardDescription>
          Historical odds changes over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="home">Home</TabsTrigger>
            <TabsTrigger value="draw">Draw</TabsTrigger>
            <TabsTrigger value="away">Away</TabsTrigger>
            <TabsTrigger value="margin">Margin %</TabsTrigger>
          </TabsList>
          
          <TabsContent value={tab} className="mt-0 pt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(timestamp) => format(new Date(timestamp), 'M/dd HH:mm')}
                    minTickGap={50}
                  />
                  <YAxis 
                    domain={tab === 'margin' ? ['dataMin - 0.2', 'dataMax + 0.2'] : [0, 'auto']}
                    tickFormatter={(value) => value.toFixed(2)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {bookmakers.map((bookmaker, index) => (
                    <Line
                      key={bookmaker}
                      type="monotone"
                      dataKey={bookmaker}
                      name={bookmaker}
                      stroke={colors[index % colors.length]}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}