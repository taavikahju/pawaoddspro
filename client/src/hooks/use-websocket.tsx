import { useState, useEffect, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
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

  // Connect to WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      // Try to reconnect after 3 seconds
      setTimeout(() => {
        setSocket(null);
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

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
          default:
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