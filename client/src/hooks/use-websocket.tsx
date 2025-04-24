import { useState, useEffect, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  event?: string;
  data: any;
}

export function useWebSocket() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [scraperStatuses, setScraperStatuses] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Connect to WebSocket with reconnection logic
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const INITIAL_RECONNECT_DELAY = 1000; // 1 second
    const MAX_RECONNECT_DELAY = 30000; // 30 seconds
    
    function connectWebSocket() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      };
      
      ws.onclose = (event) => {
        console.log(`WebSocket disconnected (code: ${event.code})`);
        setIsConnected(false);
        
        // Only attempt to reconnect if the close was not clean (e.g., due to network failure)
        // or if it was a normal closure but not due to page navigation
        if (!event.wasClean || event.code === 1000) {
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts),
            MAX_RECONNECT_DELAY
          );
          
          reconnectAttempts++;
          console.log(`Attempting to reconnect (attempt ${reconnectAttempts}) in ${delay}ms...`);
          
          if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
            reconnectTimeout = setTimeout(() => {
              setSocket(null); // This will trigger a reconnect via the dependency array
            }, delay);
          } else {
            console.error(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`);
          }
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      return ws;
    }
    
    const ws = connectWebSocket();
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);

        switch (message.type) {
          case 'stats':
            setStats(message.data);
            break;
          case 'scraperStatuses':
            setScraperStatuses(message.data);
            break;
          case 'events':
            setEvents(message.data);
            break;
          case 'notification':
            setNotifications(prev => [...prev, message.data]);
            break;
          case 'scraperEvent':
            // Just process the last message - the ScraperActivityFeed component
            // will handle displaying this data
            console.log('Scraper event received:', message.event, message.data);
            break;
          default:
            console.log('Unknown message type:', message.type);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  // Send a message to the WebSocket server
  const sendMessage = useCallback((type: string, data?: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type,
        data: data || {}
      }));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, [socket]);

  // Request events
  const getEvents = useCallback(() => {
    sendMessage('getEvents');
  }, [sendMessage]);

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