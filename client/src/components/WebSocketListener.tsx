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
  
  // The component doesn't render anything
  return null;
}