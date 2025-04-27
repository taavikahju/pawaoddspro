import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, RefreshCw, Check, X, Activity, Clock, Lightbulb } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

interface LiveScraperEvent {
  id: string;
  name: string;
  country: string;
  tournament: string;
  marketAvailability: string;
  currentlyAvailable: boolean;
  recordCount: number;
  gameMinute?: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  uptimePercentage?: number; // Added for uptime tracking
}

interface LiveScraperStats {
  totalEvents: number;
  availableMarkets: number;
  suspendedMarkets: number;
  eventDetails: LiveScraperEvent[];
}

interface LiveScraperStatus {
  isRunning: boolean;
  marketStats: LiveScraperStats;
}

interface LiveScraperPanelProps {
  isAdmin: boolean;
}

export default function LiveScraperPanel({ isAdmin }: LiveScraperPanelProps) {
  const [apiUrl, setApiUrl] = useState<string>('');
  const [eventUptimeData, setEventUptimeData] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch the current status of the live scraper
  const { 
    data: status, 
    isLoading, 
    error,
    refetch 
  } = useQuery<LiveScraperStatus>({
    queryKey: ['/api/live-scraper/status'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Start the live scraper
  const startScraperMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest('POST', '/api/live-scraper/start', { apiUrl: url }, true); // Set isAdmin=true
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/live-scraper/status'] });
      toast({
        title: 'Live Scraper Started',
        description: 'BetPawa Ghana live scraper is now running every 10 seconds',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Start Scraper',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Stop the live scraper
  const stopScraperMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/live-scraper/stop', null, true); // Set isAdmin=true
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/live-scraper/status'] });
      toast({
        title: 'Live Scraper Stopped',
        description: 'BetPawa Ghana live scraper has been stopped',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Stop Scraper',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  // Handle the start scraper button click
  const handleStartScraper = () => {
    if (!apiUrl.trim()) {
      toast({
        title: 'API URL Required',
        description: 'Please enter the BetPawa Ghana API URL',
        variant: 'destructive',
      });
      return;
    }
    
    startScraperMutation.mutate(apiUrl);
  };

  // Handle the stop scraper button click
  const handleStopScraper = () => {
    stopScraperMutation.mutate();
  };

  // Effects to check status periodically
  useEffect(() => {
    // If there's an error in the API status, show a toast
    if (error) {
      toast({
        title: 'Error Fetching Scraper Status',
        description: (error as Error).message || 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  }, [error, toast]);
  
  // Use the uptimePercentage provided by the backend directly
  useEffect(() => {
    if (!status?.marketStats?.eventDetails?.length) return;
    
    const updatedUptimeData: Record<string, number> = {};
    
    // Debug the incoming event data
    console.log('Event details received:', status.marketStats.eventDetails.map(event => ({
      id: event.id,
      name: event.name,
      uptimePercentage: event.uptimePercentage,
      marketAvailability: event.marketAvailability,
      homeScore: event.homeScore,
      awayScore: event.awayScore
    })));
    
    // Get the uptimePercentage directly from the event details
    status.marketStats.eventDetails.forEach((event) => {
      // First check for a proper uptimePercentage from the backend
      if (typeof event.uptimePercentage === 'number' && !isNaN(event.uptimePercentage)) {
        updatedUptimeData[event.id] = event.uptimePercentage;
      } 
      // Fallback to calculating from marketAvailability string
      else if (event.marketAvailability) {
        const availabilityString = event.marketAvailability;
        let percentageValue = 0;
        
        try {
          // Remove percentage sign and parse as number
          percentageValue = parseFloat(availabilityString.replace('%', ''));
          
          // Only use if it's a valid number
          if (!isNaN(percentageValue)) {
            updatedUptimeData[event.id] = percentageValue;
          }
        } catch (e) {
          console.error(`Error parsing marketAvailability for event ${event.id}:`, e);
        }
      }
    });
    
    console.log('Uptime data calculated:', updatedUptimeData);
    
    // Only update the state if we have data
    if (Object.keys(updatedUptimeData).length > 0) {
      setEventUptimeData(updatedUptimeData);
    }
  }, [status?.marketStats?.eventDetails]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Loading live scraper status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full overflow-hidden border-t-4 border-t-primary">
      <CardHeader className="bg-slate-50 dark:bg-slate-900/40 pb-3">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center text-lg">
              <Activity className="h-5 w-5 mr-2 text-primary" />
              Live Event Market Status
            </CardTitle>
            <CardDescription>
              Monitors market availability during live events in real-time
            </CardDescription>
          </div>
          <Badge 
            variant={status?.isRunning ? "default" : "secondary"}
            className={`text-xs flex items-center gap-1 ${status?.isRunning ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : ""}`}
          >
            {status?.isRunning ? (
              <>
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                Running
              </>
            ) : (
              <>Stopped</>
            )}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        {/* Admin Controls */}
        {isAdmin && (
          <div className="mb-6 space-y-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-md border border-dashed">
            <div className="text-sm font-medium text-primary flex items-center mb-2">
              <Lightbulb className="h-4 w-4 mr-1" /> Admin Controls
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Enter API URL for market tracking"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="flex-1"
                disabled={status?.isRunning || startScraperMutation.isPending}
              />
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleStartScraper}
                  disabled={status?.isRunning || startScraperMutation.isPending || !apiUrl.trim()}
                  className="flex-shrink-0"
                >
                  {startScraperMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Start
                </Button>
                
                <Button
                  size="sm" 
                  variant="outline"
                  onClick={handleStopScraper}
                  disabled={!status?.isRunning || stopScraperMutation.isPending}
                  className="flex-shrink-0"
                >
                  {stopScraperMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4 mr-1" />
                  )}
                  Stop
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refetch()}
                  className="flex-shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Stats Overview */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3 flex items-center text-muted-foreground">
            <Clock className="h-4 w-4 mr-1" />
            Real-time Market Availability
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50">
              <CardContent className="p-3 flex items-center">
                <div className="bg-blue-100 dark:bg-blue-800/30 p-2 rounded-full mr-3">
                  <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-400">Total Events</p>
                  <p className="text-xl font-bold text-blue-800 dark:text-blue-300">
                    {status?.marketStats.totalEvents || 0}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/50">
              <CardContent className="p-3 flex items-center">
                <div className="bg-green-100 dark:bg-green-800/30 p-2 rounded-full mr-3">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-green-700 dark:text-green-400">Available Markets</p>
                  <p className="text-xl font-bold text-green-800 dark:text-green-300">
                    {status?.marketStats.availableMarkets || 0}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50">
              <CardContent className="p-3 flex items-center">
                <div className="bg-red-100 dark:bg-red-800/30 p-2 rounded-full mr-3">
                  <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-red-700 dark:text-red-400">Suspended Markets</p>
                  <p className="text-xl font-bold text-red-800 dark:text-red-300">
                    {status?.marketStats.suspendedMarkets || 0}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Availability Bar */}
          {(() => {
            if (!status || !status.marketStats) return null;
            const { marketStats } = status;
            if (!marketStats.totalEvents || marketStats.totalEvents <= 0) return null;
            
            const availableMarkets = marketStats.availableMarkets || 0;
            const totalEvents = marketStats.totalEvents || 1;
            const percentage = Math.round((availableMarkets / totalEvents) * 100);
            
            return (
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">
                    Market Availability ({percentage}%)
                  </span>
                  <span className="font-medium">
                    {availableMarkets} / {totalEvents}
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-2"
                />
              </div>
            );
          })()}
        </div>
        
        {/* Events Table */}
        {status?.marketStats?.eventDetails && status?.marketStats?.eventDetails.length > 0 ? (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-900/40">
                  <TableHead className="w-[30%]">Event</TableHead>
                  <TableHead className="w-[20%]">Tournament</TableHead>
                  <TableHead className="w-[12%]">Availability</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                  <TableHead className="w-[16%]">Uptime</TableHead>
                  <TableHead className="w-[10%] text-right">History</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status?.marketStats?.eventDetails?.map((event) => (
                  <TableRow key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20">
                    <TableCell className="font-medium">
                      <div className="truncate max-w-[200px]">{event.name}</div>
                      {/* Display game minute, uptime and score if available */}
                      <div className="text-xs text-muted-foreground mt-1 flex items-center flex-wrap">
                        {event.gameMinute && (
                          <span className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded mr-2 mb-1">
                            {event.gameMinute}'
                          </span>
                        )}
                        
                        {/* Uptime percentage badge - use direct uptime percentage if available */}
                        {(event.uptimePercentage !== undefined || eventUptimeData[event.id] !== undefined) && (
                          <span className={`px-1 py-0.5 rounded mr-2 mb-1 ${
                            (event.uptimePercentage || eventUptimeData[event.id]) > 75 ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 
                            (event.uptimePercentage || eventUptimeData[event.id]) > 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' : 
                            (event.uptimePercentage || eventUptimeData[event.id]) > 30 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' : 
                            'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            Uptime: {(event.uptimePercentage || eventUptimeData[event.id] || 0).toFixed(1)}%
                          </span>
                        )}
                        
                        {(event.homeScore !== undefined && event.awayScore !== undefined) && (
                          <span className="font-medium mb-1">
                            {event.homeScore} - {event.awayScore}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground block">{event.country}</span>
                      {event.tournament}
                    </TableCell>
                    <TableCell>{event.marketAvailability}</TableCell>
                    <TableCell>
                      {event.currentlyAvailable ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800/50">
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/50">
                          Suspended
                        </Badge>
                      )}
                    </TableCell>
                    {/* Uptime Percentage Column */}
                    <TableCell>
                      {(eventUptimeData[event.id] !== undefined || event.uptimePercentage !== undefined) ? (
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mr-2">
                            <div 
                              className="h-2.5 rounded-full" 
                              style={{
                                width: `${event.uptimePercentage !== undefined ? event.uptimePercentage : eventUptimeData[event.id]}%`,
                                backgroundColor: (event.uptimePercentage || eventUptimeData[event.id]) > 75 ? '#16a34a' : 
                                                (event.uptimePercentage || eventUptimeData[event.id]) > 50 ? '#eab308' : 
                                                (event.uptimePercentage || eventUptimeData[event.id]) > 30 ? '#f97316' : '#ef4444'
                              }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium">
                            {(event.uptimePercentage !== undefined ? event.uptimePercentage : eventUptimeData[event.id]).toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Calculating...</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{event.recordCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : status?.isRunning ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-3 text-primary/40" />
            <p className="text-sm">Waiting for live events data...</p>
            <p className="text-xs mt-1">The scraper will collect market data on the next run.</p>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Pause className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm">Live scraper is not running</p>
            <p className="text-xs mt-1">Start the scraper to monitor market availability.</p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="border-t bg-slate-50 dark:bg-slate-900/40 py-2 px-4 text-xs text-muted-foreground">
        <div className="flex items-center justify-between w-full">
          <span>
            {status?.isRunning ? 'Updated in real-time' : 'Scraper stopped'}
          </span>
          <span className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}