import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Calendar, Map, Filter, History, Gauge } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

// Component for displaying uptime metrics in a modern gauge
const UptimeGauge = ({ value, min, max, avg, title }: { value: number, min: number, max: number, avg: number, title: string }) => {
  const data = [
    { name: 'Minimum', value: min, fill: '#f87171' },
    { name: 'Average', value: avg, fill: '#fbbf24' },
    { name: 'Maximum', value: max, fill: '#34d399' },
  ];

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div className="text-sm font-medium mb-2 text-center text-muted-foreground flex items-center gap-1">
        <Gauge className="h-4 w-4" />
        {title}
      </div>
      <div className="w-full h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart 
            cx="50%" 
            cy="50%" 
            innerRadius="40%" 
            outerRadius="100%" 
            barSize={10} 
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background
              dataKey="value"
              cornerRadius={5}
              label={{ position: 'insideStart', fill: '#fff', fontSize: 11, fontWeight: 'bold' }}
            />
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-lg font-bold"
              fill="#888"
            >
              {value.toFixed(1)}%
            </text>
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between w-full text-xs text-muted-foreground mt-1">
        <div className="flex items-center">
          <span className="w-2 h-2 bg-red-400 rounded-full mr-1"></span>
          <span>Min: {min.toFixed(1)}%</span>
        </div>
        <div className="flex items-center">
          <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
          <span>Max: {max.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import HeartbeatGraph from '../components/HeartbeatGraph';
import Layout from '@/components/Layout';
import { queryClient } from '@/lib/queryClient';
import ReactCountryFlag from 'react-country-flag';

interface HeartbeatEvent {
  id: string;
  name: string;
  country: string;
  tournament: string;
  isInPlay: boolean;
  startTime: string;
  currentlyAvailable: boolean;
  marketAvailability: string;
  recordCount: number;
  gameMinute?: string;
  widgetId?: string;
  homeTeam?: string;
  awayTeam?: string;
}

export default function LiveHeartbeat() {
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'historical'>('live');
  
  // Define uptime statistics state
  const [uptimeStats, setUptimeStats] = useState({
    current: 0,
    min: 0,
    max: 0,
    avg: 0,
    events: 0
  });
  
  // Fetch heartbeat stats for the selected event
  const { data: eventStatsData } = useQuery<{
    success: boolean;
    data: {
      id: number;
      timestamp: number;
      time: string;
      eventId: string;
      isAvailable: boolean;
    }[];
  }>({
    queryKey: ['/api/live-heartbeat/stats/event', selectedEventId],
    enabled: !!selectedEventId,
  });
  
  // Calculate uptime statistics from event stats data
  useEffect(() => {
    if (eventStatsData?.success && eventStatsData.data?.length > 0) {
      const stats = eventStatsData.data;
      const totalCount = stats.length;
      const availableCount = stats.filter(stat => stat.isAvailable).length;
      const uptime = totalCount > 0 ? (availableCount / totalCount) * 100 : 0;
      
      // Demo values for min/max/avg - in a real implementation, these would come from backend calculations
      // across all filtered events based on country/tournament
      const min = Math.max(uptime - 15, 0); // Demo value: current minus 15%, but not below 0
      const max = Math.min(uptime + 10, 100); // Demo value: current plus 10%, but not above 100
      const avg = (min + uptime + max) / 3; // Demo value: simple average of the three

      setUptimeStats({
        current: uptime,
        min: min,
        max: max,
        avg: avg,
        events: 5 // Demo count of events
      });
    }
  }, [eventStatsData, selectedEventId]);

  // Fetch live heartbeat data
  const { data: heartbeatData, isLoading: isLoadingLive, error: liveError, refetch: refetchLive } = useQuery<{
    events: HeartbeatEvent[];
    countries: string[];
    tournaments: Record<string, string[]>;
    lastUpdate: number;
    isRunning: boolean;
  }>({
    queryKey: ['/api/live-heartbeat/status'],
    refetchInterval: activeTab === 'live' ? 30000 : false, // Only refresh when on live tab
  });
  
  // Fetch historical events data
  const { data: historicalData, isLoading: isLoadingHistorical, error: historicalError, refetch: refetchHistorical } = useQuery<{
    success: boolean;
    data: HeartbeatEvent[];
  }>({
    queryKey: ['/api/live-heartbeat/historical-events'],
    enabled: activeTab === 'historical', // Only fetch when on historical tab
  });

  // Set the first event as selected when data is loaded
  useEffect(() => {
    if (heartbeatData?.events && heartbeatData.events.length > 0 && !selectedEventId) {
      setSelectedEventId(heartbeatData.events[0].id);
    }
  }, [heartbeatData, selectedEventId]);

  // Filter events based on selected country and tournament
  const filteredEvents = React.useMemo(() => {
    // Get the appropriate events based on active tab
    const events = activeTab === 'live' 
      ? heartbeatData?.events || []
      : historicalData?.data || [];
    
    return events.filter(event => {
      const countryMatch = selectedCountry === 'all' || event.country === selectedCountry;
      const tournamentMatch = selectedTournament === 'all' || event.tournament === selectedTournament;
      return countryMatch && tournamentMatch;
    });
  }, [heartbeatData, historicalData, selectedCountry, selectedTournament, activeTab]);

  // Format date to "DD MMM HH:MM" format 
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Handle country selection change
  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    setSelectedTournament('all'); // Reset tournament when country changes
  };

  // Handle tournament selection change
  const handleTournamentChange = (value: string) => {
    setSelectedTournament(value);
  };

  // Handle manual refresh
  const handleRefresh = () => {
    if (activeTab === 'live') {
      refetchLive();
    } else {
      refetchHistorical();
    }
  };

  // Get tournaments for the selected country
  const tournamentsForCountry = React.useMemo(() => {
    if (!heartbeatData?.tournaments) return [];
    if (selectedCountry === 'all') {
      // Combine all tournaments from all countries
      return [...new Set(
        Object.values(heartbeatData.tournaments).flat()
      )].sort();
    }
    return heartbeatData.tournaments[selectedCountry] || [];
  }, [heartbeatData, selectedCountry]);

  // Set the last update time
  const lastUpdate = heartbeatData?.lastUpdate
    ? new Date(heartbeatData.lastUpdate).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC'
      }) + ' UTC'
    : 'N/A';

  return (
    <Layout>
      <div className="container mx-auto py-4 px-4">
        <div className="flex flex-col space-y-4">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center">
                <Activity className="mr-2 h-6 w-6 text-primary" />
                Live Heartbeat Monitor
              </h1>
              <p className="text-muted-foreground text-sm">
                Monitor market availability for live events
              </p>
            </div>
          </div>

          {/* Tabs for switching between live and historical views */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'live' | 'historical')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="live" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Live Events
              </TabsTrigger>
              <TabsTrigger value="historical" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Historical Events
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters Section */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-md flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Map className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={selectedCountry}
                      onValueChange={handleCountryChange}
                    >
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Select Country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <span className="flex items-center gap-2">
                            <span className="opacity-60">🌎</span> All Countries
                          </span>
                        </SelectItem>
                        {heartbeatData?.countries?.map(country => {
                          // Convert country name to 2-letter ISO code for the flag
                          // This is a simple mapping for common countries
                          const getCountryCode = (countryName: string) => {
                            const codeMap: Record<string, string> = {
                              'Australia': 'AU',
                              'England': 'GB',
                              'United Kingdom': 'GB',
                              'France': 'FR',
                              'Germany': 'DE',
                              'Spain': 'ES',
                              'Italy': 'IT',
                              'Brazil': 'BR',
                              'Portugal': 'PT',
                              'Netherlands': 'NL',
                              'Belgium': 'BE',
                              'Croatia': 'HR',
                              'Romania': 'RO',
                              'Russia': 'RU',
                              'Russian Federation': 'RU',
                              'China': 'CN',
                              'Chinese Taipei': 'TW',
                              'Japan': 'JP',
                              'Korea': 'KR',
                              'Republic of Korea': 'KR',
                              'South Korea': 'KR',
                              'Greece': 'GR',
                              'Turkey': 'TR',
                              'Ghana': 'GH',
                              'Kenya': 'KE',
                              'Uganda': 'UG',
                              'South Africa': 'ZA',
                              'Nigeria': 'NG',
                              'India': 'IN',
                              'International': 'WW',
                              'Israel': 'IL',
                              'New Zealand': 'NZ',
                              'Hong Kong': 'HK',
                              'Czech Republic': 'CZ',
                              'Hungary': 'HU',
                              'Tanzania': 'TZ',
                              'Sweden': 'SE',
                              'Norway': 'NO',
                              'Denmark': 'DK',
                              'Finland': 'FI',
                              'Iceland': 'IS',
                              'Poland': 'PL',
                              'Ethiopia': 'ET',
                              'Zambia': 'ZM',
                              'Zimbabwe': 'ZW',
                              'Mexico': 'MX',
                              'Argentina': 'AR',
                              'Chile': 'CL',
                              'Colombia': 'CO',
                              'Egypt': 'EG',
                              'Morocco': 'MA',
                              'Tunisia': 'TN',
                              'Uruguay': 'UY',
                              'Iraq': 'IQ',
                              'Iran': 'IR',
                            };
                            
                            return codeMap[countryName] || 'UN'; // Default to UN flag if country not found
                          };
                          
                          const countryCode = getCountryCode(country);
                          
                          return (
                            <SelectItem key={country} value={country}>
                              <span className="flex items-center gap-2">
                                {countryCode !== 'WW' && countryCode !== 'UN' ? (
                                  <ReactCountryFlag 
                                    countryCode={countryCode} 
                                    svg 
                                    style={{ width: '1em', height: '1em' }}
                                  />
                                ) : countryCode === 'WW' ? (
                                  <span>🌐</span>
                                ) : (
                                  <span>🏳️</span>
                                )}
                                {country}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={selectedTournament}
                      onValueChange={handleTournamentChange}
                      disabled={tournamentsForCountry.length === 0}
                    >
                      <SelectTrigger className="w-[240px] h-9">
                        <SelectValue placeholder="Select Tournament" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tournaments</SelectItem>
                        {tournamentsForCountry.map(tournament => (
                          <SelectItem key={tournament} value={tournament}>
                            {tournament}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear filters button */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setSelectedCountry('all');
                      setSelectedTournament('all');
                    }}
                    className="gap-1"
                  >
                    Clear Filters
                  </Button>
                </div>
                
                {/* Uptime Statistics Gauge */}
                <div className="mt-4 border rounded-lg p-4 bg-card/50">
                  <div className="text-sm font-medium mb-3 text-center">Market Uptime Statistics</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <UptimeGauge 
                      value={uptimeStats.current} 
                      min={uptimeStats.min} 
                      max={uptimeStats.max} 
                      avg={uptimeStats.avg} 
                      title="Current Event" 
                    />
                    <UptimeGauge 
                      value={uptimeStats.avg} 
                      min={uptimeStats.min} 
                      max={uptimeStats.max} 
                      avg={uptimeStats.avg} 
                      title="Average Uptime" 
                    />
                    <div className="flex flex-col justify-center items-center">
                      <div className="text-xl font-bold">{uptimeStats.events}</div>
                      <div className="text-sm text-muted-foreground">Total Events</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Events List */}
            <Card className="md:col-span-1 overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-md">Events</CardTitle>
                <CardDescription>
                  {filteredEvents.length} events found
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
                  {(activeTab === 'live' ? isLoadingLive : isLoadingHistorical) ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Loading events...
                    </div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No events found for the selected filters
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredEvents.map(event => (
                        <div
                          key={event.id}
                          className={`p-2 cursor-pointer hover:bg-accent ${
                            selectedEventId === event.id
                              ? 'bg-accent'
                              : ''
                          }`}
                          onClick={() => setSelectedEventId(event.id)}
                        >
                          <div className="flex flex-col mb-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                {event.isInPlay && (
                                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" 
                                    title="Live event" />
                                )}
                                {/* Only show market availability for live events, not historical ones */}
                                {activeTab === 'live' ? (
                                  <Badge 
                                    variant={event.currentlyAvailable ? 'outline' : 'destructive'}
                                    className="text-[10px] h-5 ml-1"
                                  >
                                    {event.currentlyAvailable ? 'Available' : 'Suspended'}
                                  </Badge>
                                ) : (
                                  <Badge 
                                    variant="secondary"
                                    className="text-[10px] h-5 ml-1"
                                  >
                                    Completed
                                  </Badge>
                                )}
                                {event.gameMinute && (
                                  <Badge variant="secondary" className="text-[10px] h-5 ml-1">
                                    {event.gameMinute === 'HT' || event.gameMinute?.toLowerCase() === 'ht' 
                                      ? 'HT' 
                                      : !event.gameMinute.includes("'") 
                                        ? `${event.gameMinute}'` 
                                        : event.gameMinute}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="font-medium text-sm w-full" style={{wordWrap: 'break-word'}}>
                              {event.homeTeam && event.awayTeam 
                                ? `${event.homeTeam} vs ${event.awayTeam}` 
                                : event.name}
                            </div>
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              {(() => {
                                const getCountryCode = (countryName: string) => {
                                  const codeMap: Record<string, string> = {
                                    'Australia': 'AU',
                                    'England': 'GB',
                                    'United Kingdom': 'GB',
                                    'France': 'FR',
                                    'Germany': 'DE',
                                    'Spain': 'ES',
                                    'Italy': 'IT',
                                    'Brazil': 'BR',
                                    'Portugal': 'PT',
                                    'Netherlands': 'NL',
                                    'Belgium': 'BE',
                                    'Croatia': 'HR',
                                    'Romania': 'RO',
                                    'Russia': 'RU',
                                    'Russian Federation': 'RU',
                                    'China': 'CN',
                                    'Chinese Taipei': 'TW',
                                    'Japan': 'JP',
                                    'Korea': 'KR',
                                    'Republic of Korea': 'KR',
                                    'South Korea': 'KR',
                                    'Greece': 'GR',
                                    'Turkey': 'TR',
                                    'Ghana': 'GH',
                                    'Kenya': 'KE',
                                    'Uganda': 'UG',
                                    'South Africa': 'ZA',
                                    'Nigeria': 'NG',
                                    'India': 'IN',
                                    'International': 'WW',
                                    'Israel': 'IL',
                                    'New Zealand': 'NZ',
                                    'Hong Kong': 'HK',
                                  };
                                  
                                  return codeMap[countryName] || 'UN';
                                };
                                
                                const countryCode = getCountryCode(event.country);
                                
                                return countryCode !== 'WW' && countryCode !== 'UN' ? (
                                  <ReactCountryFlag 
                                    countryCode={countryCode} 
                                    svg 
                                    style={{ width: '0.8em', height: '0.8em' }}
                                    className="mr-1"
                                    title={event.country}
                                  />
                                ) : countryCode === 'WW' ? (
                                  <span className="mr-1" title={event.country}>🌐</span>
                                ) : (
                                  <span className="mr-1" title={event.country}>🏳️</span>
                                );
                              })()}
                              <span>{event.tournament}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Heartbeat Graph */}
            <div className="md:col-span-2">
              {selectedEventId ? (
                <HeartbeatGraph 
                  eventId={selectedEventId}
                />
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <CardContent className="text-center py-10">
                    <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                    <p>Select an event to view its heartbeat data</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}