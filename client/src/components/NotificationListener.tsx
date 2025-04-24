import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';

/**
 * NotificationListener is a utility component that listens to websocket 
 * notifications and displays them as toasts.
 * This component doesn't render anything, it just provides notification functionality.
 */
export default function NotificationListener() {
  const { notifications } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      // Get the most recent notification
      const latestNotification = notifications[notifications.length - 1];
      
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
  }, [notifications, toast]);

  // This component doesn't render anything
  return null;
}