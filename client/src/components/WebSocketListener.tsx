import { useRealWebSocket } from "@/hooks/use-real-websocket";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useEffect } from "react";

/**
 * This component maintains a WebSocket connection to the server to receive real-time updates
 * It listens for refresh events and notifications from the server
 * and triggers appropriate actions like invalidating queries
 */
export default function WebSocketListener() {
  const { isConnected, lastMessage } = useRealWebSocket();
  const { toast } = useToast();
  
  // Display connection status changes
  useEffect(() => {
    if (isConnected) {
      toast({
        title: 'Connected',
        description: 'Real-time data connection established',
        variant: 'default'
      });
    }
  }, [isConnected, toast]);
  
  // Handle incoming messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        
        console.log('WebSocket message received:', data.type);
        
        if (data.type === 'events_updated') {
          // Invalidate the events cache to force a refresh
          console.log('Invalidating events cache due to websocket update');
          queryClient.invalidateQueries({ queryKey: ['/api/events'] });
          
          // Show a notification toast
          toast({
            title: 'Data Updated',
            description: `${data.count || ''} events have been updated`,
            variant: 'default'
          });
        } else if (data.type === 'sportybet_updated') {
          // Specifically invalidate Sportybet-related data
          console.log('Invalidating Sportybet odds cache due to websocket update');
          queryClient.invalidateQueries({ queryKey: ['/api/events'] });
          
          toast({
            title: 'Sportybet Updated',
            description: `Latest Sportybet odds now available`,
            variant: 'default'
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    }
  }, [lastMessage, toast]);
  
  // The component doesn't render anything
  return null;
}