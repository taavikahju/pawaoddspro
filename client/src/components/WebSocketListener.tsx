import { useRealWebSocket } from "@/hooks/use-real-websocket";
import { useToast } from "@/hooks/use-toast";
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
      console.info('WebSocket connected');
      toast({
        title: 'Connected',
        description: 'Real-time data connection established',
        variant: 'default'
      });
    } else {
      console.warn('WebSocket disconnected');
    }
  }, [isConnected, toast]);
  
  // The component doesn't render anything
  return null;
}