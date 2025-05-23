import { useState, useEffect, useRef } from 'react';
import { queryClient } from '@/lib/queryClient';

export function useRealWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrapeCompleteTime = useRef<number>(0);

  useEffect(() => {
    // Function to connect to the WebSocket server
    const connectWebSocket = () => {
      try {
        // Close existing connection if any
        if (socketRef.current) {
          socketRef.current.close();
        }
        
        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        // Silent connection - no logging
        
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        
        // Connection opened
        socket.addEventListener('open', () => {
          // Connected silently
          setIsConnected(true);
          
          // Clear any existing reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        });
        
        // Listen for messages
        socket.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(event.data);
            setLastMessage(message);
            
            // Handle both complete scrape notifications and individual scraper completion
            if (message.type === 'scrapeCompleted' || message.type === 'scraperFinished') {
              // Removed rate limiting to ensure immediate updates
              // Always refresh immediately on any scraper completion
              lastScrapeCompleteTime.current = Date.now();
              
              // Invalidate event queries to trigger a refresh with latest data
              queryClient.invalidateQueries({ queryKey: ['/api/events'] });
              queryClient.invalidateQueries({ queryKey: ['/api/events?includeSportybet=true'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
              
              // Disabled logging as requested
              // console.log(`Refreshing data after ${message.type} event`);
            }
            
            // Still track stats updates
            if (message.type === 'updateStats') {
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
            }
          } catch (error) {
            // Silent error handling for parsing errors
          }
        });
        
        // Connection closed
        socket.addEventListener('close', () => {
          // Silent disconnect
          setIsConnected(false);
          
          // Attempt to reconnect after a delay
          reconnectTimeoutRef.current = setTimeout(() => {
            // Silent reconnection
            connectWebSocket();
          }, 5000); // Try to reconnect after 5 seconds
        });
        
        // Connection error
        socket.addEventListener('error', () => {
          // Silent error handling
          // Let the close event handler handle reconnection
        });
      } catch (error) {
        // Silent error handling
        // Attempt to reconnect after a delay
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 5000);
      }
    };
    
    // Initialize WebSocket connection
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    isConnected,
    lastMessage
  };
}