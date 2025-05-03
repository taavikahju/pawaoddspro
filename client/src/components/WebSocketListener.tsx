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
        const { bookmaker, eventCount } = lastMessage.data;
        
        // Invalidate queries to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['/api/events'] });
        queryClient.invalidateQueries({ queryKey: ['/api/events?includeSportybet=true'] });
        
        toast({
          title: `${bookmaker.name} updated`,
          description: `Refreshed with ${eventCount} events`,
          variant: 'default'
        });
      }
      
      // Handle events data update
      if (lastMessage.type === 'events' || lastMessage.type === 'scrapeCompleted') {
        // Invalidate queries to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['/api/events'] });
        queryClient.invalidateQueries({ queryKey: ['/api/events?includeSportybet=true'] });
        
        toast({
          title: 'Data updated',
          description: 'Latest odds data loaded',
          variant: 'default'
        });
      }
      
      // Handle notification messages from the server
      if (lastMessage.type === 'notification') {
        const { message, status } = lastMessage.data;
        
        toast({
          title: status === 'error' ? 'Error' : 'Update',
          description: message,
          variant: status === 'error' ? 'destructive' : 'default'
        });
      }
    }
  }, [lastMessage, toast, queryClient]);
  
  // The component doesn't render anything
  return null;
}