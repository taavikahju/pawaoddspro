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
    const MAX_RECONNECT_ATTEMPTS = 20;
    const INITIAL_RECONNECT_DELAY = 1000; // 1 second
    const MAX_RECONNECT_DELAY = 30000; // 30 seconds
    
    function connectWebSocket() {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log(`Connecting to WebSocket at ${wsUrl}...`);
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket connected successfully');
          setIsConnected(true);
          reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          
          // Immediately request current data from server
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'getEvents' }));
              ws.send(JSON.stringify({ type: 'getStats' }));
            }
          } catch (sendError) {
            console.error('Error sending initial requests:', sendError);
          }
        };
        
        ws.onclose = (event) => {
          console.log(`WebSocket disconnected (code: ${event.code}, clean: ${event.wasClean})`);
          setIsConnected(false);
          
          // Always attempt to reconnect except when the tab is being closed
          if (document.visibilityState !== 'hidden') {
            const delay = Math.min(
              INITIAL_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts),
              MAX_RECONNECT_DELAY
            );
            
            reconnectAttempts++;
            console.log(`Attempting to reconnect (attempt ${reconnectAttempts}) in ${delay}ms...`);
            
            if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
              reconnectTimeout = setTimeout(() => {
                console.log('Reconnecting now...');
                setSocket(null); // This will trigger a reconnect when this useEffect runs again
              }, delay);
            } else {
              console.error(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached.`);
            }
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Don't disconnect here - let the onclose handler handle reconnection
        };
        
        return ws;
      } catch (error) {
        console.error('Error initializing WebSocket:', error);
        return null;
      }
    }
    
    const ws = connectWebSocket();
    
    // Handle the case where WebSocket connection fails to initialize
    if (!ws) {
      console.error('Failed to initialize WebSocket, will retry...');
      
      // Try to reconnect after a delay
      const retryDelay = 3000;
      reconnectAttempts++;
      reconnectTimeout = setTimeout(() => {
        setSocket(null); // Trigger reconnect
      }, retryDelay);
      
      return () => {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
      };
    }
    
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
      if (ws) {
        ws.close();
      }
      
      // Clean up any reconnection timeouts
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
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