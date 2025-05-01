import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
// Keep the import for backward compatibility
import { useWebSocket } from '@/hooks/use-websocket';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  timestamp: string;
  event: string; // This is required
  message: string;
  status: 'info' | 'success' | 'warning' | 'error';
  data?: {
    timestamp?: string;
    message?: string;
    bookmaker?: {
      code: string;
      name: string;
    };
    eventCount?: number;
    error?: string;
    stats?: Record<string, any>;
    [key: string]: any;
  };
}

export default function ScraperActivityFeed() {
  // We'll keep the WebSocket interface for compatibility but add direct API queries
  const { lastMessage } = useWebSocket();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  
  // Fetch scraper statuses from API directly
  const { data: scraperStatuses = [] } = useQuery({
    queryKey: ['/api/scrapers/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Generate activity items from the scraper status API
  useEffect(() => {
    if (scraperStatuses && Array.isArray(scraperStatuses) && scraperStatuses.length > 0) {
      const newActivities = scraperStatuses.map((scraper: {
        name: string;
        code?: string;
        lastRun?: string;
        eventCount?: number;
        status?: string;
      }) => {
        // Create an activity based on the scraper status
        const status = scraper.lastRun ? 'success' : 'info';
        const event = scraper.lastRun ? 'scraper:COMPLETED' : 'scraper:WAITING';
        const timestamp = scraper.lastRun || new Date().toISOString();
        
        return {
          id: `${scraper.name}-${timestamp}`,
          timestamp,
          event,
          message: scraper.lastRun 
            ? `${scraper.name} last ran at ${new Date(scraper.lastRun).toLocaleTimeString()}`
            : `${scraper.name} waiting to run`,
          status: status as 'info' | 'success' | 'warning' | 'error',
          data: {
            bookmaker: {
              code: scraper.code || 'unknown',
              name: scraper.name
            },
            eventCount: scraper.eventCount || 0
          }
        };
      });
      
      // Only update if we have actual new data
      if (newActivities.length > 0) {
        setActivities(prev => {
          // Combine new activities with existing ones and remove duplicates
          const combined = [...newActivities, ...prev];
          const unique = combined.filter((item, index, self) => 
            index === self.findIndex(t => t.id === item.id)
          );
          return unique.slice(0, 50); // Keep only last 50 activities
        });
      }
    }
  }, [scraperStatuses]);
  
  // Also keep the legacy WebSocket support
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'scraperEvent' && lastMessage.event) {
      const { event, data } = lastMessage;
      
      const newActivity: ActivityItem = {
        id: `${event}-${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
        event: event || 'unknown-event',
        message: data.message || 'Activity update',
        status: getStatusFromEvent(event || ''),
        data
      };
      
      setActivities(prev => [newActivity, ...prev].slice(0, 50)); // Keep only last 50 activities
    }
  }, [lastMessage]);

  // Map event types to status
  const getStatusFromEvent = (event: string): 'info' | 'success' | 'warning' | 'error' => {
    if (event.includes('COMPLETED')) {
      return 'success';
    } else if (event.includes('STARTED')) {
      return 'info';
    } else if (event.includes('FAILED')) {
      return 'error';
    } else {
      return 'info';
    }
  };

  // Get badge color based on status
  const getBadgeColor = (status: string): string => {
    switch (status) {
      case 'success':
        return 'bg-green-500 hover:bg-green-600';
      case 'error':
        return 'bg-red-500 hover:bg-red-600';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600';
      default:
        return 'bg-blue-500 hover:bg-blue-600';
    }
  };

  // Format event name for display
  const formatEventName = (event: string): string => {
    return event
      .replace('scraper:', '')
      .split(':')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Scraper Activity</CardTitle>
        <CardDescription>Real-time updates from scrapers</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity yet. Activities will appear here when scrapers run.
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="border rounded-lg p-3 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getBadgeColor(activity.status)}>
                      {formatEventName(activity.event)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm mb-2">{activity.message}</p>
                  
                  {/* Render additional data if available */}
                  {activity.data && activity.data.bookmaker && (
                    <div className="text-xs text-muted-foreground mt-2">
                      <span className="font-semibold">Bookmaker:</span> {activity.data.bookmaker.name}
                    </div>
                  )}
                  
                  {activity.data && activity.data.eventCount !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold">Events:</span> {activity.data.eventCount}
                    </div>
                  )}
                  
                  {activity.data && activity.data.error && (
                    <div className="text-xs text-red-500 mt-1">
                      <span className="font-semibold">Error:</span> {activity.data.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Showing the last {Math.min(activities.length, 50)} activities
      </CardFooter>
    </Card>
  );
}