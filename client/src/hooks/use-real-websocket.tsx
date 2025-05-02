import { useState, useEffect, useRef } from 'react';
import { queryClient } from '@/lib/queryClient';

export function useRealWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        console.log(`[WebSocket] Connecting to ${wsUrl}`);
        
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        
        // Connection opened
        socket.addEventListener('open', () => {
          console.log('[WebSocket] Connected successfully');
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
            
            // Handle different message types
            if (message.type === 'refreshEvents') {
              console.log('[WebSocket] Received refreshEvents message, invalidating events query');
              // Invalidate the events query to trigger a refetch
              queryClient.invalidateQueries({ queryKey: ['/api/events'] });
              queryClient.invalidateQueries({ queryKey: ['/api/events?includeSportybet=true'] });
            }
            
            if (message.type === 'updateStats') {
              console.log('[WebSocket] Received updateStats message, invalidating stats query');
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
            }
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        });
        
        // Connection closed
        socket.addEventListener('close', () => {
          console.log('[WebSocket] Connection closed');
          setIsConnected(false);
          
          // Attempt to reconnect after a delay
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Attempting to reconnect...');
            connectWebSocket();
          }, 5000); // Try to reconnect after 5 seconds
        });
        
        // Connection error
        socket.addEventListener('error', (error) => {
          console.error('[WebSocket] Connection error:', error);
          // Let the close event handler handle reconnection
        });
      } catch (error) {
        console.error('[WebSocket] Setup error:', error);
        // Attempt to reconnect after a delay
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] Attempting to reconnect after error...');
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