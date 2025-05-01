import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
// Keep for backward compatibility
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';

/**
 * NotificationListener is a utility component that listens to server notifications
 * using both React Query polling and websocket and displays them as toasts.
 * This component doesn't render anything, it just provides notification functionality.
 */
export default function NotificationListener() {
  // Keep WebSocket for backward compatibility
  const { notifications: wsNotifications } = useWebSocket();
  const { toast } = useToast();
  
  // Replace with direct API notification polling
  const { data: apiNotifications = [] } = useQuery({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000, // Check for new notifications every 30 seconds
  });
  
  // Reference to track which API notifications we've already shown
  const shownApiNotifications = useRef<Set<string>>(new Set());
  
  // Handle API-based notifications
  useEffect(() => {
    if (apiNotifications && Array.isArray(apiNotifications) && apiNotifications.length > 0) {
      // Get the most recent notification that hasn't been shown yet
      const newNotifications = apiNotifications.filter(
        (notification: {id: string; message: string; type?: string}) => 
          !shownApiNotifications.current.has(notification.id)
      );
      
      if (newNotifications.length > 0) {
        const latestNotification = newNotifications[0];
        
        // Mark this notification as shown
        shownApiNotifications.current.add(latestNotification.id);
        
        const { message, type = 'info' } = latestNotification;
        
        // Determine toast variant based on status
        let variant: 'default' | 'destructive' = 'default';
        let title = 'Notification';
        
        if (type === 'error') {
          variant = 'destructive';
          title = 'Error';
        } else if (type === 'success') {
          title = 'Success';
        } else if (type === 'info') {
          title = 'Information';
        } else if (type === 'warning') {
          title = 'Warning';
        }
        
        // Show toast
        toast({
          title,
          description: message,
          variant
        });
      }
    }
  }, [apiNotifications, toast]);
  
  // Also keep the legacy WebSocket handler for backward compatibility
  useEffect(() => {
    if (wsNotifications && wsNotifications.length > 0) {
      // Get the most recent notification
      const latestNotification = wsNotifications[wsNotifications.length - 1];
      
      if (latestNotification) {
        const { message, status } = latestNotification;
        
        // Determine toast variant based on status
        let variant: 'default' | 'destructive' = 'default';
        let title = 'Notification';
        
        if (status === 'error') {
          variant = 'destructive';
          title = 'Error';
        } else if (status === 'success') {
          title = 'Success';
        } else if (status === 'info') {
          title = 'Information';
        } else if (status === 'warning') {
          title = 'Warning';
        }
        
        // Show toast
        toast({
          title,
          description: message,
          variant
        });
      }
    }
  }, [wsNotifications, toast]);

  // This component doesn't render anything
  return null;
}