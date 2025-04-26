import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Calendar, Map, Filter, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Removed Tabs import as view type selection is no longer needed
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

  // Fetch heartbeat data
  const { data: heartbeatData, isLoading, error, refetch } = useQuery<{
    events: HeartbeatEvent[];
    countries: string[];
    tournaments: Record<string, string[]>;
    lastUpdate: number;
    isRunning: boolean;
  }>({
    queryKey: ['/api/live-heartbeat/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Set the first event as selected when data is loaded
  useEffect(() => {
    if (heartbeatData?.events && heartbeatData.events.length > 0 && !selectedEventId) {
      setSelectedEventId(heartbeatData.events[0].id);
    }
  }, [heartbeatData, selectedEventId]);

  // Filter events based on selected country and tournament
  const filteredEvents = React.useMemo(() => {
    if (!heartbeatData?.events) return [];
    
    return heartbeatData.events.filter(event => {
      const countryMatch = selectedCountry === 'all' || event.country === selectedCountry;
      const tournamentMatch = selectedTournament === 'all' || event.tournament === selectedTournament;
      return countryMatch && tournamentMatch;
    });
  }, [heartbeatData, selectedCountry, selectedTournament]);

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
    refetch();
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
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh} 
                className="gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Badge 
                variant={heartbeatData?.isRunning ? "outline" : "destructive"}
                className="px-2 py-1 h-9"
              >
                Tracker: {heartbeatData?.isRunning ? 'Running' : 'Stopped'}
              </Badge>
              <Badge 
                variant="outline"
                className="px-2 py-1 h-9"
              >
                Last Update: {lastUpdate}
              </Badge>
            </div>
          </div>

          {/* Filters Section */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-md flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
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

                {/* View type selection removed as events are already ordered by start time */}
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
                  {isLoading ? (
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
                                <Badge 
                                  variant={event.currentlyAvailable ? 'outline' : 'destructive'}
                                  className="text-[10px] h-5 ml-1"
                                >
                                  {event.currentlyAvailable ? 'Available' : 'Suspended'}
                                </Badge>
                                {event.gameMinute && (
                                  <Badge variant="secondary" className="text-[10px] h-5 ml-1">
                                    {event.gameMinute}
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
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
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
                            <span>{formatDate(event.startTime)}</span>
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