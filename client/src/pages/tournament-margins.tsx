import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from '@tanstack/react-query';
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
import { Loader2 } from 'lucide-react';
import { useBookmakerContext } from '@/contexts/BookmakerContext';

const TournamentMargins: React.FC = () => {
  const { bookmakers } = useBookmakerContext();
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [tournamentInput, setTournamentInput] = useState<string>('');
  const [selectedBookmaker, setSelectedBookmaker] = useState<string>('');
  
  // Query to load tournament margin data
  const { data, isLoading, error, refetch } = useQuery<any[]>({
    queryKey: [`/api/tournaments/margins?tournament=${encodeURIComponent(selectedTournament)}${selectedBookmaker ? `&bookmaker=${encodeURIComponent(selectedBookmaker)}` : ''}`],
    enabled: !!selectedTournament,
  });
  
  // Process the data for the chart
  const [chartData, setChartData] = useState<any[]>([]);
  
  useEffect(() => {
    if (!data || !data.length) {
      setChartData([]);
      return;
    }
    
    try {
      // Group by timestamp first
      const timestampMap = new Map<string, Record<string, any>>();
      
      for (const record of data) {
        const timestamp = record.timestamp;
        
        if (!timestampMap.has(timestamp)) {
          timestampMap.set(timestamp, {
            timestamp,
            date: new Date(timestamp).toLocaleString(),
          });
        }
        
        const dataPoint = timestampMap.get(timestamp)!;
        dataPoint[record.bookmakerCode] = record.margin;
      }
      
      // Convert map to array and sort by timestamp
      const processedData = Array.from(timestampMap.values())
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      setChartData(processedData);
    } catch (error) {
      console.error('Error processing tournament margin data:', error);
      setChartData([]);
    }
  }, [data]);
  
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
  
  // Get available tournaments
  const [tournaments, setTournaments] = useState<string[]>([]);
  
  useEffect(() => {
    // Mock tournament list until we have a real endpoint
    setTournaments([
      'Premier League',
      'La Liga',
      'Serie A',
      'Bundesliga',
      'Ligue 1',
      'Champions League',
      'Europa League',
      'World Cup',
      'UEFA Euro',
      'Copa America'
    ]);
  }, []);
  
  // Filter tournaments based on input
  const filteredTournaments = tournaments.filter(tournament => 
    tournament.toLowerCase().includes(tournamentInput.toLowerCase())
  );
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };
  
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Tournament Margins</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Filter Options</CardTitle>
            <CardDescription>
              Select a tournament and bookmaker to view margin history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tournament">Tournament</Label>
                <Input
                  id="tournament"
                  value={tournamentInput}
                  onChange={(e) => setTournamentInput(e.target.value)}
                  placeholder="Search tournaments..."
                  className="mb-2"
                />
                <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTournaments.map(tournament => (
                      <SelectItem key={tournament} value={tournament}>
                        {tournament}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bookmaker">Bookmaker (Optional)</Label>
                <Select value={selectedBookmaker} onValueChange={setSelectedBookmaker}>
                  <SelectTrigger>
                    <SelectValue placeholder="All bookmakers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All bookmakers</SelectItem>
                    {bookmakers.map(bookmaker => (
                      <SelectItem key={bookmaker.code} value={bookmaker.code}>
                        {bookmaker.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button type="submit" className="w-full">
                View Margins
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedTournament ? `Margin History: ${selectedTournament}` : 'Tournament Margin History'}
            </CardTitle>
            <CardDescription>
              {selectedBookmaker 
                ? `Showing data for ${selectedBookmaker}` 
                : 'Comparing margins across all bookmakers'}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-[400px]">
            {!selectedTournament && (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">
                  Select a tournament to view margin history data
                </p>
              </div>
            )}
            
            {selectedTournament && isLoading && (
              <div className="h-[400px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {selectedTournament && error && (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-red-500">
                  Failed to load tournament margin data
                </p>
              </div>
            )}
            
            {selectedTournament && !isLoading && !error && (!chartData || chartData.length === 0) && (
              <div className="h-[400px] flex items-center justify-center">
                <p className="text-muted-foreground">
                  No margin history data available for {selectedTournament}
                </p>
              </div>
            )}
            
            {selectedTournament && !isLoading && !error && chartData && chartData.length > 0 && (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      label={{ 
                        value: 'Margin %', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle' }
                      }}
                      domain={['dataMin - 0.01', 'dataMax + 0.01']}
                      tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'Margin']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    
                    {bookmakers
                      .filter(bookmaker => !selectedBookmaker || bookmaker.code === selectedBookmaker)
                      .map(bookmaker => 
                        chartData.some(dp => dp[bookmaker.code] !== undefined) && (
                          <Line
                            key={bookmaker.code}
                            type="monotone"
                            dataKey={bookmaker.code}
                            name={bookmaker.name}
                            stroke={getBookmakerColor(bookmaker.code)}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TournamentMargins;