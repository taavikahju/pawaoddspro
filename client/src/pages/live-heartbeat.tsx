import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Activity, HeartPulse, Clock, Filter, Calendar, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import HeartbeatGraph from '@/components/HeartbeatGraph';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface LiveEvent {
  id: string;
  name: string;
  country: string;
  tournament: string;
  marketAvailability: string;
  currentlyAvailable: boolean;
  recordCount: number;
  isInPlay: boolean;
  startTime: string;
}

interface LiveHeartbeatState {
  isRunning: boolean;
  events: LiveEvent[];
  countries: string[];
  tournaments: Record<string, string[]>;
}

export default function LiveHeartbeatPage() {
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [filteredEvents, setFilteredEvents] = useState<LiveEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  
  // Fetch live heartbeat data
  const { 
    data: heartbeatData,
    isLoading,
    error,
    refetch
  } = useQuery<LiveHeartbeatState>({
    queryKey: ['/api/live-heartbeat/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Start the live heartbeat tracker if not running
  useEffect(() => {
    // If the tracker is not running, start it
    if (heartbeatData && !heartbeatData.isRunning) {
      startHeartbeatTracker();
    }
  }, [heartbeatData]);

  // Filter events when country/tournament selection or search changes
  useEffect(() => {
    if (!heartbeatData?.events) {
      setFilteredEvents([]);
      return;
    }

    let filtered = [...heartbeatData.events];
    
    // Apply country filter
    if (selectedCountry) {
      filtered = filtered.filter(event => event.country === selectedCountry);
    }
    
    // Apply tournament filter
    if (selectedTournament) {
      filtered = filtered.filter(event => event.tournament === selectedTournament);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        event.name.toLowerCase().includes(query) || 
        event.tournament.toLowerCase().includes(query)
      );
    }
    
    // Apply view mode filter (active vs history)
    if (viewMode === 'active') {
      filtered = filtered.filter(event => event.isInPlay);
    }
    
    setFilteredEvents(filtered);
    
    // Deselect event if it's no longer in the filtered list
    if (selectedEvent && !filtered.find(e => e.id === selectedEvent.id)) {
      setSelectedEvent(null);
    }
  }, [heartbeatData, selectedCountry, selectedTournament, searchQuery, viewMode, selectedEvent]);
  
  // Handle country selection change
  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    setSelectedTournament(''); // Reset tournament when country changes
  };
  
  // Handle tournament selection change
  const handleTournamentChange = (value: string) => {
    setSelectedTournament(value);
  };
  
  // Handle event selection
  const handleEventSelect = (event: LiveEvent) => {
    setSelectedEvent(event);
  };
  
  // Start the heartbeat tracker
  const startHeartbeatTracker = async () => {
    try {
      const apiUrl = "https://www.betpawa.com.gh/api/sportsbook/v2/events/lists/by-queries?q=%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B%222%22%5D%2C%22zones%22%3A%7B%7D%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A0%2C%22sort%22%3A%7B%22competitionPriority%22%3A%22DESC%22%7D%2C%22take%22%3A20%7D%5D%7D";
      await apiRequest('POST', '/api/live-heartbeat/start', { apiUrl }, true);
      toast({
        title: 'Live Heartbeat Tracker Started',
        description: 'Monitoring market availability in real-time',
      });
      refetch();
    } catch (error: any) {
      toast({
        title: 'Failed to Start Tracker',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    }
  };
  
  // Helper to get available tournaments for the selected country
  const getAvailableTournaments = (): string[] => {
    if (!selectedCountry || !heartbeatData?.tournaments) return [];
    return heartbeatData.tournaments[selectedCountry] || [];
  };
  
  if (isLoading) {
    return (
      <Layout 
        title="Live Heartbeat" 
        subtitle="Real-time market availability tracking"
      >
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center">
            <HeartPulse className="h-12 w-12 text-primary animate-pulse mb-4" />
            <p className="text-muted-foreground">Loading heartbeat data...</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  if (error) {
    return (
      <Layout 
        title="Live Heartbeat" 
        subtitle="Real-time market availability tracking"
      >
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <div className="text-red-500 mb-4">
              <Activity className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium mb-2">Error Loading Heartbeat Data</h3>
            <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }
  
  return (
    <Layout 
      title="Live Heartbeat" 
      subtitle="Real-time market availability tracking"
    >
      {/* Tabs for Active/History */}
      <Tabs defaultValue="active" className="mb-6" onValueChange={(value) => setViewMode(value as 'active' | 'history')}>
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-1">
              <HeartPulse className="h-4 w-4" />
              <span>Live Events</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>History</span>
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Badge variant={heartbeatData?.isRunning ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              {heartbeatData?.isRunning ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  Monitoring
                </>
              ) : (
                <>Stopped</>
              )}
            </Badge>
            
            <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh data">
              <Clock className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Content for both tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="text-sm font-medium mb-2 flex items-center">
                <Filter className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>Filter By Country</span>
              </div>
              <Select value={selectedCountry} onValueChange={handleCountryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Countries</SelectItem>
                  {heartbeatData?.countries?.map((country) => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <div className="text-sm font-medium mb-2 flex items-center">
                <Filter className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>Filter By Tournament</span>
              </div>
              <Select 
                value={selectedTournament} 
                onValueChange={handleTournamentChange}
                disabled={!selectedCountry}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCountry ? "Select tournament" : "Select country first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Tournaments</SelectItem>
                  {getAvailableTournaments().map((tournament) => (
                    <SelectItem key={tournament} value={tournament}>{tournament}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <div className="text-sm font-medium mb-2 flex items-center">
                <Search className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>Search Events</span>
              </div>
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <TabsContent value="active" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Events List */}
            <div className="lg:col-span-1">
              <Card className="h-[500px] overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-primary" />
                    Live Events
                  </CardTitle>
                  <CardDescription>
                    {filteredEvents.length} events available
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[400px] overflow-y-auto">
                    {filteredEvents.length > 0 ? (
                      <Table>
                        <TableHeader className="sticky top-0 bg-white dark:bg-slate-800">
                          <TableRow>
                            <TableHead>Event</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEvents.map((event) => (
                            <TableRow 
                              key={event.id} 
                              className={`cursor-pointer ${selectedEvent?.id === event.id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                              onClick={() => handleEventSelect(event)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {event.isInPlay && (
                                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                  )}
                                  <div>
                                    <div className="font-medium">{event.name}</div>
                                    <div className="text-xs text-muted-foreground">{event.tournament}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={event.currentlyAvailable ? "outline" : "secondary"}
                                  className={event.currentlyAvailable ? 
                                    "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200" : 
                                    "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200"}
                                >
                                  {event.currentlyAvailable ? "Available" : "Suspended"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-muted-foreground p-4">
                          <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                          <p>No live events found</p>
                          <p className="text-xs mt-1">Try changing your filters</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Heartbeat Graph */}
            <div className="lg:col-span-2">
              <Card className="h-[500px]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <HeartPulse className="h-5 w-5 mr-2 text-primary" />
                    Market Heartbeat
                  </CardTitle>
                  <CardDescription>
                    {selectedEvent ? (
                      <div className="flex items-center justify-between">
                        <span>{selectedEvent.name}</span>
                        <Badge variant={selectedEvent.isInPlay ? "default" : "secondary"} className="ml-2">
                          {selectedEvent.isInPlay ? "In-Play" : "Not Live"}
                        </Badge>
                      </div>
                    ) : (
                      "Select an event to view real-time market heartbeat"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedEvent ? (
                    <div className="h-[400px]">
                      <HeartbeatGraph eventId={selectedEvent.id} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[400px]">
                      <div className="text-center text-muted-foreground">
                        <HeartPulse className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                        <p>Select an event from the list</p>
                        <p className="text-xs mt-1">to view its market heartbeat</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Historical Events List - Same structure as active but with different data source */}
            <div className="lg:col-span-1">
              <Card className="h-[500px] overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-primary" />
                    Historical Events
                  </CardTitle>
                  <CardDescription>
                    {filteredEvents.length} historical events
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[400px] overflow-y-auto">
                    {filteredEvents.length > 0 ? (
                      <Table>
                        <TableHeader className="sticky top-0 bg-white dark:bg-slate-800">
                          <TableRow>
                            <TableHead>Event</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEvents.map((event) => (
                            <TableRow 
                              key={event.id} 
                              className={`cursor-pointer ${selectedEvent?.id === event.id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                              onClick={() => handleEventSelect(event)}
                            >
                              <TableCell>
                                <div>
                                  <div className="font-medium">{event.name}</div>
                                  <div className="text-xs text-muted-foreground">{event.tournament}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{new Date(event.startTime).toLocaleDateString()}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(event.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-muted-foreground p-4">
                          <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                          <p>No historical events found</p>
                          <p className="text-xs mt-1">Try changing your filters</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Historical Heartbeat Graph - Same structure as active but with historical data */}
            <div className="lg:col-span-2">
              <Card className="h-[500px]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <HeartPulse className="h-5 w-5 mr-2 text-primary" />
                    Historical Market Heartbeat
                  </CardTitle>
                  <CardDescription>
                    {selectedEvent ? (
                      <div className="flex items-center justify-between">
                        <span>{selectedEvent.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {new Date(selectedEvent.startTime).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      "Select an event to view historical market heartbeat"
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedEvent ? (
                    <div className="h-[400px]">
                      <HeartbeatGraph eventId={selectedEvent.id} historical={true} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[400px]">
                      <div className="text-center text-muted-foreground">
                        <HeartPulse className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                        <p>Select a historical event from the list</p>
                        <p className="text-xs mt-1">to view its market heartbeat patterns</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Footer Info */}
      <div className="text-xs text-muted-foreground text-center mt-6">
        <p>Market availability is tracked every 10 seconds for live events.</p>
        <p className="mt-1">
          The heartbeat graph shows green pulses when odds are available and drops when markets are suspended.
        </p>
      </div>
    </Layout>
  );
}