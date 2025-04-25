import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock, BarChart2 } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LiveScraperStatusProps {
  isAdmin: boolean;
}

interface LiveScraperStatus {
  isRunning: boolean;
  marketStats: {
    totalEvents: number;
    availableMarkets: number;
    suspendedMarkets: number;
    eventDetails: Array<{
      id: string;
      name: string;
      country: string;
      tournament: string;
      marketAvailability: string;
      currentlyAvailable: boolean;
      recordCount: number;
    }>;
  };
}

const LiveScraperPanel: React.FC<LiveScraperStatusProps> = ({ isAdmin }) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<LiveScraperStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [apiUrl, setApiUrl] = useState('');

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/live-scraper/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching live scraper status:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch live scraper status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startScraper = async () => {
    if (!apiUrl) {
      toast({
        title: 'Error',
        description: 'API URL is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsStarting(true);
      const adminKey = localStorage.getItem('adminKey');
      const response = await axios.post('/api/live-scraper/start', 
        { apiUrl },
        { headers: { 'x-admin-key': adminKey } }
      );
      
      toast({
        title: 'Success',
        description: 'BetPawa Ghana live scraper started',
        variant: 'default',
      });
      
      // Fetch updated status
      fetchStatus();
    } catch (error) {
      console.error('Error starting live scraper:', error);
      toast({
        title: 'Error',
        description: 'Failed to start live scraper',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const stopScraper = async () => {
    try {
      setIsStopping(true);
      const adminKey = localStorage.getItem('adminKey');
      const response = await axios.post('/api/live-scraper/stop', 
        {},
        { headers: { 'x-admin-key': adminKey } }
      );
      
      toast({
        title: 'Success',
        description: 'BetPawa Ghana live scraper stopped',
        variant: 'default',
      });
      
      // Fetch updated status
      fetchStatus();
    } catch (error) {
      console.error('Error stopping live scraper:', error);
      toast({
        title: 'Error',
        description: 'Failed to stop live scraper',
        variant: 'destructive',
      });
    } finally {
      setIsStopping(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !status) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>BetPawa Ghana Live Scraper</CardTitle>
          <CardDescription>
            Tracks market availability every 10 seconds
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>BetPawa Ghana Live Scraper</CardTitle>
            <CardDescription>
              Tracks market availability every 10 seconds
            </CardDescription>
          </div>
          {status && (
            <Badge
              variant={status.isRunning ? "default" : "outline"}
              className={status.isRunning ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {status.isRunning ? (
                <>
                  <Clock className="h-3 w-3 mr-1" />
                  Running
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Stopped
                </>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{status.marketStats.totalEvents}</div>
                <div className="text-sm">Total Events</div>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{status.marketStats.availableMarkets}</div>
                <div className="text-sm">Available Markets</div>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{status.marketStats.suspendedMarkets}</div>
                <div className="text-sm">Suspended Markets</div>
              </div>
            </div>
            
            {status.marketStats.eventDetails.length > 0 ? (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted border-b">
                      <th className="px-4 py-2 text-left text-xs font-medium">Event</th>
                      <th className="px-4 py-2 text-left text-xs font-medium">Tournament</th>
                      <th className="px-4 py-2 text-center text-xs font-medium">Status</th>
                      <th className="px-4 py-2 text-center text-xs font-medium">Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.marketStats.eventDetails.slice(0, 5).map((event) => (
                      <tr key={event.id} className="border-b last:border-0">
                        <td className="px-4 py-2 text-xs">{event.name}</td>
                        <td className="px-4 py-2 text-xs">{event.tournament}</td>
                        <td className="px-4 py-2 text-center">
                          {event.currentlyAvailable ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Suspended
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            <BarChart2 className="h-3 w-3 mr-1" />
                            {event.marketAvailability}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {status.marketStats.eventDetails.length > 5 && (
                  <div className="bg-muted text-center py-2 text-xs text-muted-foreground">
                    + {status.marketStats.eventDetails.length - 5} more events
                  </div>
                )}
              </div>
            ) : (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Data</AlertTitle>
                <AlertDescription>
                  No live events have been tracked yet.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {isAdmin && (
          <div className="mt-4">
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="BetPawa Ghana API URL"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                disabled={isStarting || isStopping || status?.isRunning}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={startScraper}
                disabled={isStarting || isStopping || status?.isRunning || !apiUrl}
                className="flex-1"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  'Start Live Scraper'
                )}
              </Button>
              <Button
                onClick={stopScraper}
                disabled={isStarting || isStopping || !status?.isRunning}
                variant="outline"
                className="flex-1"
              >
                {isStopping ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  'Stop Live Scraper'
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveScraperPanel;