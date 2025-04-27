import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Calendar, Map, Filter, History } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CanvasHeartbeatGraph from '../components/CanvasHeartbeatGraph';
import Layout from '@/components/Layout';
import ReactCountryFlag from 'react-country-flag';

// Component for displaying uptime metrics with a gauge that looks like a speedometer
const UptimeGauge = ({ value }: { value: number }) => {
  // Ensure value is within 0-100 range to prevent rendering issues
  const safeValue = Math.max(0, Math.min(100, value || 0));
  
  // Calculate rotation angle for the needle (from -90 to 90 degrees)
  // 0% is at -90 degrees, 50% at 0 degrees, and 100% at 90 degrees
  const rotation = -90 + (safeValue / 100) * 180;
  
  // Get color based on value
  const getColor = (val: number) => {
    if (val < 40) return '#ef4444'; // red
    if (val < 60) return '#f97316'; // orange
    if (val < 75) return '#eab308'; // yellow
    return '#16a34a'; // green
  };
  
  // Get needle color based on the value
  const needleColor = getColor(safeValue);
  
  return (
    <div className="flex items-center">
      <div className="text-sm font-medium text-muted-foreground mr-2">
        Average Uptime:
      </div>
      <div className="flex flex-col items-center">
        <div className="relative w-[120px] h-[70px]">
          <svg className="w-full h-full" viewBox="0 0 120 70">
            {/* Gauge background */}
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="30%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="70%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
            </defs>
            
            {/* Gauge arc (semi-circle) */}
            <path 
              d="M 10 60 A 50 50 0 0 1 110 60" 
              fill="transparent" 
              stroke="url(#gaugeGradient)" 
              strokeWidth="10" 
              strokeLinecap="round"
            />
            
            {/* Percentage markers */}
            <g fill="currentColor" fontFamily="sans-serif" fontSize="8">
              <text x="10" y="68" textAnchor="middle">0%</text>
              <text x="60" y="20" textAnchor="middle">50%</text>
              <text x="110" y="68" textAnchor="middle">100%</text>
            </g>
            
            {/* Ticks for scale */}
            <g stroke="#64748b" strokeWidth="1">
              <line x1="10" y1="60" x2="10" y2="55" />
              <line x1="35" y1="35" x2="38" y2="32" />
              <line x1="60" y1="20" x2="60" y2="25" />
              <line x1="85" y1="35" x2="82" y2="32" />
              <line x1="110" y1="60" x2="110" y2="55" />
            </g>
            
            {/* Center point */}
            <circle cx="60" cy="60" r="6" fill="#64748b" />
            
            {/* Needle with color based on value */}
            <g transform={`rotate(${rotation}, 60, 60)`}>
              {/* Needle shadow/outline for better visibility */}
              <line 
                x1="60" 
                y1="60" 
                x2="60" 
                y2="25" 
                stroke="rgba(0,0,0,0.3)" 
                strokeWidth="5" 
                strokeLinecap="round"
              />
              
              {/* Actual needle */}
              <line 
                x1="60" 
                y1="60" 
                x2="60" 
                y2="25" 
                stroke={needleColor} 
                strokeWidth="3" 
                strokeLinecap="round"
              />
            </g>
            
            {/* Center point overlay */}
            <circle cx="60" cy="60" r="4" fill="white" />
          </svg>
        </div>
        
        {/* Percentage text */}
        <div className="text-center text-sm font-medium" style={{ color: getColor(safeValue) }}>
          {safeValue.toFixed(1)}%
        </div>
      </div>
    </div>
  );
};

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
  suspended?: boolean; // Added suspended property for historical events
}

export default function LiveHeartbeat() {
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedTournament, setSelectedTournament] = useState<string>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'historical'>('live');
  
  // Define uptime statistics state
  const [uptimeStats, setUptimeStats] = useState({
    current: 0,
    events: 0
  });
  
  // Track state for suspended events
  const [lastDataFetchTime, setLastDataFetchTime] = useState<Record<string, number>>({});
  const [consecutiveSuspensionCounts, setConsecutiveSuspensionCounts] = useState<Record<string, number>>({});
  
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
    onSuccess: (data) => {
      if (data?.events) {
        // Normalize data on frontend to ensure suspended events are properly marked
        const suspendedCount = data.events.filter(e => !e.currentlyAvailable || e.suspended).length;
        console.log(`FRONTEND: Received ${data.events.length} events from API, ${suspendedCount} are suspended`);
        
        // Log any suspended events for debugging
        if (suspendedCount > 0) {
          const suspendedEvents = data.events.filter(e => !e.currentlyAvailable || e.suspended);
          console.log(`FRONTEND: Found suspended events:`, 
            suspendedEvents.map(e => ({
              id: e.id, 
              name: e.name,
              suspended: e.suspended,
              currentlyAvailable: e.currentlyAvailable
            }))
          );
        }
      }
    },
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
  
  // Update suspension count tracking - moved from useMemo
  useEffect(() => {
    const events = activeTab === 'live' 
      ? heartbeatData?.events || []
      : (historicalData?.success ? historicalData.data : []);
      
    if (!events || events.length === 0) return;
    
    const newSuspensionCounts = {...consecutiveSuspensionCounts};
    const now = Date.now();
    
    events.forEach(event => {
      // If event is suspended, increment counter
      if (event.suspended || !event.currentlyAvailable) {
        newSuspensionCounts[event.id] = (newSuspensionCounts[event.id] || 0) + 1;
      } else {
        // If event is available, reset counter
        newSuspensionCounts[event.id] = 0;
      }
      
      // Track when we last saw this event
      setLastDataFetchTime(prev => ({
        ...prev,
        [event.id]: now
      }));
    });
    
    setConsecutiveSuspensionCounts(newSuspensionCounts);
    
    // Log any events that have been suspended for a long time
    const longSuspendedEvents = events.filter(e => 
      (e.suspended || !e.currentlyAvailable) && 
      (newSuspensionCounts[e.id] || 0) >= 5
    );
    
    if (longSuspendedEvents.length > 0) {
      console.log(`DEBUG: ${longSuspendedEvents.length} events have been suspended for 5+ consecutive checks:`);
      console.log(longSuspendedEvents.map(e => `${e.id} (${e.name}): ${newSuspensionCounts[e.id]} checks`));
    }
  }, [heartbeatData, historicalData, activeTab]);

  // Filter events based on selected country and tournament
  const filteredEvents = React.useMemo(() => {
    // Get the appropriate events based on active tab
    const events = activeTab === 'live' 
      ? heartbeatData?.events || []
      : (historicalData?.success ? historicalData.data : []);
    
    // Remove finished events using more sophisticated checks:
    // An event is likely finished if:
    // 1. It is suspended (not in the current API response) AND has a start time more than 3 hours ago
    // 2. It has recordCount of 0 or very low (indicating it's not being actively tracked anymore)
    // 3. It has been suspended for multiple scraping cycles
    
    const threeHoursAgo = new Date();
    threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);
    
    // The suspension count tracking logic is now in a separate useEffect hook at component level
    
    const activeEvents = events.filter(event => {
      // Always keep non-suspended events
      if (!event.suspended && event.currentlyAvailable !== false) {
        return true;
      }
      
      // For suspended events, perform multiple checks
      const eventStartTime = new Date(event.startTime);
      const isRecentEvent = eventStartTime > threeHoursAgo;
      
      // Special check for BetGenius events (widget IDs starting with "12" or "11")
      // These are events like Marist Fire vs KOSSA FC that weren't showing up
      if (event.widgetId && (event.widgetId.startsWith('12') || event.widgetId.startsWith('11'))) {
        console.log(`Including BetGenius event: ${event.id} (${event.name})`);
        // Always include these events regardless of record count
        return true;
      }
      
      // Check if it has a reasonable record count (indicating active tracking)
      // For BetGenius events, we'll relax this requirement since they have their own tracking
      const hasLowRecordCount = event.recordCount < 3;
      
      // Check if it's been suspended for multiple consecutive checks 
      const longSuspended = (consecutiveSuspensionCounts[event.id] || 0) >= 10;
      
      // Keep the event only if it's recent AND has sufficient records AND isn't long suspended
      return isRecentEvent && !hasLowRecordCount && !longSuspended;
    });
    
    console.log(`DEBUG: Filtered out ${events.length - activeEvents.length} likely finished events (suspended & older than 3 hours)`);
    
    // Log summary of suspended events to debug
    const allSuspendedEvents = activeEvents.filter(e => !e.currentlyAvailable || e.suspended);
    console.log(`DEBUG: Found ${allSuspendedEvents.length} suspended events out of ${activeEvents.length} total`);
    
    // Always log suspended events for debugging
    if (allSuspendedEvents.length > 0) {
      console.log(`DEBUG: Suspended events:`, 
        allSuspendedEvents.map(e => ({
          id: e.id,
          name: e.name,
          country: e.country,
          tournament: e.tournament,
          currentlyAvailable: e.currentlyAvailable,
          suspended: e.suspended
        }))
      );
    }
    
    // Apply country and tournament filters
    const filteredByCountryAndTournament = activeEvents.filter(event => {
      const countryMatch = selectedCountry === 'all' || event.country === selectedCountry;
      const tournamentMatch = selectedTournament === 'all' || event.tournament === selectedTournament;
      return countryMatch && tournamentMatch;
    });
    
    // Log any filtered suspended events that were excluded
    const suspendedEventsAfterFiltering = filteredByCountryAndTournament.filter(e => !e.currentlyAvailable || e.suspended);
    if (suspendedEventsAfterFiltering.length !== allSuspendedEvents.length) {
      console.log(`DEBUG: ${allSuspendedEvents.length - suspendedEventsAfterFiltering.length} suspended events were filtered out by country/tournament selection`);
    }
    
    // Sort events by startTime (ascending) as requested by the user
    // First put live events at the top (they have isInPlay=true)
    // Then sort by startTime for all other events
    const sortedEvents = [...filteredByCountryAndTournament].sort((a, b) => {
      // First prioritize live events
      if (a.isInPlay && !b.isInPlay) return -1;
      if (!a.isInPlay && b.isInPlay) return 1;
      
      // Then sort by start time (convert strings to Date objects)
      const aTime = new Date(a.startTime);
      const bTime = new Date(b.startTime);
      return aTime.getTime() - bTime.getTime();
    });
    
    console.log("✅ Events sorted by startTime (ascending)");
    
    return sortedEvents;
  }, [heartbeatData, historicalData, selectedCountry, selectedTournament, activeTab, consecutiveSuspensionCounts]);
  
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
  
  // Fetch market history for each event to calculate overall average uptime
  const fetchAverageUptime = async () => {
    if (filteredEvents.length === 0) return;
    
    try {
      // Get uptime percentages for all events by making API calls
      const uptimePromises = filteredEvents.map(async (event) => {
        try {
          const response = await fetch(`/api/live-heartbeat/data/${event.id}`);
          if (!response.ok) return null;
          
          const data = await response.json();
          
          // Calculate uptime if not directly available from API
          if (data.timestamps && Array.isArray(data.timestamps)) {
            // Count available and suspended data points
            const availablePoints = data.timestamps.filter((p: any) => p.isAvailable).length;
            const totalPoints = data.timestamps.length;
            
            // Calculate percentage
            const calculatedUptime = totalPoints > 0 ? (availablePoints / totalPoints) * 100 : 0;
            return calculatedUptime;
          }
          
          return data.uptimePercentage || 0;
        } catch (error) {
          console.error(`Error fetching uptime for event ${event.id}:`, error);
          return null;
        }
      });
      
      // Wait for all promises to complete
      const uptimeValues = await Promise.all(uptimePromises);
      
      // Calculate the average, filtering out null values
      const validValues = uptimeValues.filter(val => val !== null);
      const averageUptime = validValues.length > 0 
        ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length 
        : 0;
      
      console.log(`Calculated average uptime across ${validValues.length} events: ${averageUptime.toFixed(1)}%`);
      
      // Update uptime stats
      setUptimeStats({
        current: averageUptime,
        events: filteredEvents.length
      });
    } catch (error) {
      console.error('Error calculating average uptime:', error);
    }
  };

  // Calculate uptime statistics from event stats data for the selected event
  useEffect(() => {
    if (eventStatsData?.success && eventStatsData.data?.length > 0) {
      const stats = eventStatsData.data;
      const totalCount = stats.length;
      const availableCount = stats.filter(stat => stat.isAvailable).length;
      const uptime = totalCount > 0 ? (availableCount / totalCount) * 100 : 0;

      // We don't update the overall uptime here anymore, just log the selected event uptime
      console.log(`Selected event ${selectedEventId} uptime: ${uptime.toFixed(1)}%`);
    }
  }, [eventStatsData, selectedEventId]);
  
  // Calculate average uptime across all filtered events
  useEffect(() => {
    fetchAverageUptime();
    // Run this calculation whenever the filtered events list changes
  }, [filteredEvents]);

  // Simple date formatting function - much faster than full locale conversion
  // Format: "DD MMM HH:MM" without unnecessary conversions
  const formatDate = (dateString: string) => {
    // If we don't have a date string, return N/A
    if (!dateString) return 'N/A';
    
    // Use cached date if possible for the same string (optimization)
    const cachedDates: Record<string, string> = {};
    if (cachedDates[dateString]) return cachedDates[dateString];
    
    try {
      const date = new Date(dateString);
      
      // Fast direct formatting without locale conversion
      const day = String(date.getUTCDate()).padStart(2, '0');
      
      // Simple month abbreviation lookup
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getUTCMonth()];
      
      const hour = String(date.getUTCHours()).padStart(2, '0');
      const minute = String(date.getUTCMinutes()).padStart(2, '0');
      
      const formatted = `${day} ${month} ${hour}:${minute}`;
      
      // Cache the result
      cachedDates[dateString] = formatted;
      
      return formatted;
    } catch (e) {
      // Fallback in case of parsing error
      return dateString;
    }
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
      return Array.from(
        new Set(Object.values(heartbeatData.tournaments).flat())
      ).sort();
    }
    return heartbeatData.tournaments[selectedCountry] || [];
  }, [heartbeatData, selectedCountry]);

  // Set the last update time using fast direct formatting
  const lastUpdate = heartbeatData?.lastUpdate
    ? (() => {
        const date = new Date(heartbeatData.lastUpdate);
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes} UTC`;
      })()
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
                <div className="flex flex-wrap gap-3 justify-between items-center">
                  <div className="flex gap-3">
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

                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        setSelectedCountry('all');
                        setSelectedTournament('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>

                  {/* Uptime gauge positioned to the right */}
                  <UptimeGauge value={uptimeStats.current} />
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
                          className={`p-2 cursor-pointer ${
                            // Priority 1: Selected event
                            selectedEventId === event.id
                              ? 'bg-accent hover:bg-accent/80'
                              // All events except selected have the same style
                              : 'hover:bg-accent'
                          }`}
                          onClick={() => {
                            console.log(`Selecting event:`, {
                              id: event.id,
                              name: event.name,
                              currentlyAvailable: event.currentlyAvailable,
                              suspended: event.suspended
                            });
                            setSelectedEventId(event.id);
                          }}
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
                                    className={`text-[10px] h-5 ml-1 ${!event.currentlyAvailable ? 'text-white' : ''}`}
                                  >
                                    {event.currentlyAvailable ? 'Available' : 'SUSPENDED'}
                                  </Badge>
                                ) : (
                                  <Badge 
                                    variant={event.suspended ? "destructive" : "secondary"}
                                    className={`text-[10px] h-5 ml-1 ${event.suspended ? 'text-white' : ''}`}
                                  >
                                    {event.suspended ? 'SUSPENDED' : 'Completed'}
                                  </Badge>
                                )}
                                {event.gameMinute && (
                                  <Badge variant="secondary" className="text-[10px] h-5 ml-1">
                                    {event.gameMinute === 'HT' || (typeof event.gameMinute === 'string' && event.gameMinute.toLowerCase() === 'ht')
                                      ? 'HT' 
                                      : typeof event.gameMinute === 'string' && !event.gameMinute.includes("'")
                                        ? `${event.gameMinute}'` 
                                        : typeof event.gameMinute === 'number'
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
                <CanvasHeartbeatGraph 
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