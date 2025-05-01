import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

// Keep a deprecated version of the WebSocket hook for backward compatibility
// while we migrate the app to use direct API calls instead of WebSockets
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(true); // Always connected in this version
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Fetch stats data using React Query
  const { 
    data: stats = { lastScrapeTime: 'N/A' },
    refetch: refetchStats
  } = useQuery<any>({ 
    queryKey: ['/api/stats'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });
  
  // Fetch scraper statuses using React Query
  const { 
    data: scraperStatuses = [],
    refetch: refetchScraperStatuses 
  } = useQuery<any[]>({ 
    queryKey: ['/api/scrapers/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Fetch events using React Query
  const { 
    data: events = [],
    refetch: refetchEvents 
  } = useQuery<any[]>({ 
    queryKey: ['/api/events'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });
  
  // Simulated send message function - for backward compatibility
  const sendMessage = useCallback((type: string, data?: any) => {
    console.log(`[WebSocket Migration] Sending message ${type}`, data);
    
    // Mapping WebSocket message types to API calls
    switch (type) {
      case 'getEvents':
        refetchEvents();
        break;
      case 'getStats':
        refetchStats();
        break;
      case 'runScrapers':
        // Make an API call to run the scrapers
        fetch('/api/scrapers/run', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            console.log('Scrapers triggered', data);
            // Add a notification
            setNotifications(prev => [...prev, {
              type: 'info',
              message: 'Scraper run triggered manually',
              timestamp: new Date().toISOString()
            }]);
          })
          .catch(err => {
            console.error('Error triggering scrapers', err);
          });
        break;
      default:
        console.warn(`[WebSocket Migration] Unhandled message type: ${type}`);
    }
  }, [refetchEvents, refetchStats]);
  
  // Request events
  const getEvents = useCallback(() => {
    refetchEvents();
  }, [refetchEvents]);
  
  // Trigger scrapers to run
  const runScrapers = useCallback(() => {
    sendMessage('runScrapers');
  }, [sendMessage]);
  
  return {
    isConnected,
    lastMessage,
    stats,
    scraperStatuses,
    events,
    notifications,
    sendMessage,
    getEvents,
    runScrapers
  };
}