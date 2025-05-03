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
            
            // Only handle complete scrape notifications
            if (message.type === 'scrapeCompleted') {
              // Rate limit updates to avoid multiple refreshes in short period
              const now = Date.now();
              const timeSinceLastScrape = now - lastScrapeCompleteTime.current;
              
              // Only update if at least 30 seconds have passed since last update
              // This prevents duplicate refreshes
              if (timeSinceLastScrape > 30000) {
                lastScrapeCompleteTime.current = now;
                
                // Invalidate event queries to trigger a refresh with complete data
                queryClient.invalidateQueries({ queryKey: ['/api/events'] });
                queryClient.invalidateQueries({ queryKey: ['/api/events?includeSportybet=true'] });
                queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
                
                // IMPORTANT: Clear any cached Sportybet odds data
                // This will invalidate ALL Sportybet odds queries
                queryClient.invalidateQueries({ 
                  predicate: (query) => {
                    return query.queryKey[0] === 'latestSportybetOdds';
                  }
                });
              }
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