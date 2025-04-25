import React, { useEffect, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface OddsDataPoint {
  timestamp: string;
  homeOdds?: string;
  drawOdds?: string;
  awayOdds?: string;
  margin?: string;
  bookmakerCode: string;
}

interface HistoricalOddsChartProps {
  eventId: string;
  onClose: () => void;
}

const COLORS = {
  'bp GH': '#FF5733',
  'bp KE': '#33FF57',
  'sporty': '#3357FF',
  'betika KE': '#FF33A8',
};

// A helper function to format the date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return format(date, 'MMM dd, HH:mm');
};

const HistoricalOddsChart: React.FC<HistoricalOddsChartProps> = ({ eventId, onClose }) => {
  const [oddsHistory, setOddsHistory] = useState<OddsDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [bookmakers, setBookmakers] = useState<Set<string>>(new Set());
  const [visibleBookmakers, setVisibleBookmakers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchOddsHistory = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/history`);
        if (!response.ok) {
          throw new Error('Failed to fetch odds history');
        }
        
        const data = await response.json();
        setOddsHistory(data);
        
        // Extract unique bookmakers
        const uniqueBookmakers = new Set<string>();
        data.forEach((item: OddsDataPoint) => {
          uniqueBookmakers.add(item.bookmakerCode);
        });
        
        setBookmakers(uniqueBookmakers);
        setVisibleBookmakers(uniqueBookmakers); // Initially show all bookmakers
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchOddsHistory();
  }, [eventId]);
  
  const toggleBookmaker = (bookmakerCode: string) => {
    const newVisibleBookmakers = new Set(visibleBookmakers);
    if (newVisibleBookmakers.has(bookmakerCode)) {
      newVisibleBookmakers.delete(bookmakerCode);
    } else {
      newVisibleBookmakers.add(bookmakerCode);
    }
    setVisibleBookmakers(newVisibleBookmakers);
  };
  
  // Prepare data for charting - we need to format timestamps and group by bookmaker
  const prepareChartData = () => {
    // Sort by timestamp ascending
    const sortedData = [...oddsHistory].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Group and format the data for the chart
    const formattedData: any[] = [];
    
    // Group by timestamp first
    const timestampGroups: Record<string, OddsDataPoint[]> = {};
    
    sortedData.forEach(item => {
      const timeKey = format(new Date(item.timestamp), 'yyyy-MM-dd HH:mm');
      if (!timestampGroups[timeKey]) {
        timestampGroups[timeKey] = [];
      }
      timestampGroups[timeKey].push(item);
    });
    
    // For each timestamp, create an entry with all bookmakers' odds
    Object.entries(timestampGroups).forEach(([timeKey, items]) => {
      const entry: any = {
        timestamp: timeKey,
        formattedTime: formatDate(items[0].timestamp)
      };
      
      // Add each bookmaker's odds to this timestamp entry
      items.forEach(item => {
        if (visibleBookmakers.has(item.bookmakerCode)) {
          if (activeTab === 'home' && item.homeOdds) {
            entry[`home_${item.bookmakerCode}`] = parseFloat(item.homeOdds);
          } else if (activeTab === 'draw' && item.drawOdds) {
            entry[`draw_${item.bookmakerCode}`] = parseFloat(item.drawOdds);
          } else if (activeTab === 'away' && item.awayOdds) {
            entry[`away_${item.bookmakerCode}`] = parseFloat(item.awayOdds);
          } else if (activeTab === 'margin' && item.margin) {
            entry[`margin_${item.bookmakerCode}`] = parseFloat(item.margin);
          }
        }
      });
      
      formattedData.push(entry);
    });
    
    return formattedData;
  };
  
  const chartData = prepareChartData();
  
  // Custom tooltip formatter to show odds values
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip bg-background p-3 border rounded-md shadow-md">
          <p className="font-medium">{payload[0]?.payload.formattedTime}</p>
          <div className="space-y-1 mt-2">
            {payload.map((entry: any) => {
              const bookmakerCode = entry.dataKey.split('_')[1];
              return (
                <p key={entry.dataKey} style={{ color: entry.color }}>
                  {bookmakerCode}: {entry.value.toFixed(2)}
                </p>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };
  
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full">
          <h2 className="text-xl font-bold mb-4">Loading historical odds data...</h2>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full">
          <h2 className="text-xl font-bold mb-4">Error</h2>
          <p className="text-red-500">{error}</p>
          <Button onClick={onClose} className="mt-4">Close</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 overflow-auto">
      <div className="bg-background p-6 rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Historical Odds</h2>
          <Button variant="ghost" onClick={onClose} className="h-8 w-8 p-0">✕</Button>
        </div>
        
        {/* Bookmaker toggles */}
        <div className="mb-4 flex flex-wrap gap-2">
          {Array.from(bookmakers).map(bookmaker => (
            <Button
              key={bookmaker}
              variant={visibleBookmakers.has(bookmaker) ? "default" : "outline"}
              className="text-xs py-1 h-8"
              onClick={() => toggleBookmaker(bookmaker)}
            >
              {bookmaker}
            </Button>
          ))}
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="home">Home Odds</TabsTrigger>
            <TabsTrigger value="draw">Draw Odds</TabsTrigger>
            <TabsTrigger value="away">Away Odds</TabsTrigger>
            <TabsTrigger value="margin">Margin %</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab}>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="formattedTime" 
                    angle={-45} 
                    textAnchor="end" 
                    height={70} 
                    tick={{ fontSize: 12 }} 
                  />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  
                  {/* Render lines for each visible bookmaker */}
                  {Array.from(visibleBookmakers).map(bookmaker => {
                    const dataKey = `${activeTab}_${bookmaker}`;
                    const color = COLORS[bookmaker as keyof typeof COLORS] || '#' + Math.floor(Math.random()*16777215).toString(16);
                    
                    return (
                      <Line
                        key={dataKey}
                        type="monotone"
                        dataKey={dataKey}
                        name={bookmaker}
                        stroke={color}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
        
        {oddsHistory.length === 0 && (
          <p className="text-center mt-4 text-muted-foreground">No historical odds data available for this event.</p>
        )}
      </div>
    </div>
  );
};

export default HistoricalOddsChart;