import { useRealWebSocket } from "@/hooks/use-real-websocket";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * This component maintains a WebSocket connection to the server to receive real-time updates
 * It listens for refresh events and notifications from the server
 * and triggers appropriate actions like invalidating queries
 */
export default function WebSocketListener() {
  const { isConnected, lastMessage } = useRealWebSocket();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lastUpdateTimestamp = useRef<number>(Date.now());
  
  // Display connection status changes - only show toast without console logging
  useEffect(() => {
    if (isConnected) {
      // Silent connection - no logging
      toast({
        title: 'Connected',
        description: 'Real-time data connection established',
        variant: 'default'
      });
    }
    // No log for disconnection either
  }, [isConnected, toast]);
  
  // Handle incoming messages, especially scraper completion events
  useEffect(() => {
    if (lastMessage) {
      // Update timestamp for any message
      lastUpdateTimestamp.current = Date.now();
      
      // Handle individual scraper completion notifications
      if (lastMessage.type === 'scraperFinished') {
        const { bookmaker } = lastMessage.data;
        
        // Silently invalidate queries to trigger refetch without notification
        queryClient.invalidateQueries({ queryKey: ['/api/events'] });
        queryClient.invalidateQueries({ queryKey: ['/api/events?includeSportybet=true'] });
        
        // Only show error toasts, not info ones (disabled as requested)
        // console.log(`${bookmaker.name} scraper finished`);
      }
      
      // Handle events data update
      if (lastMessage.type === 'events' || lastMessage.type === 'scrapeCompleted') {
        // Silently invalidate queries to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['/api/events'] });
        queryClient.invalidateQueries({ queryKey: ['/api/events?includeSportybet=true'] });
        
        // Disabled toast notifications as requested
        // console.log('Data update received');
      }
      
      // Handle notification messages from the server - only show errors
      if (lastMessage.type === 'notification') {
        const { message, status } = lastMessage.data;
        
        // Only show error notifications, not informational ones
        if (status === 'error') {
          toast({
            title: 'Error',
            description: message,
            variant: 'destructive'
          });
        }
      }
    }
  }, [lastMessage, toast, queryClient]);
  
  // The component doesn't render anything
  return null;
}