import React, { useEffect, useRef, useState } from 'react';
import { Activity, BarChart, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// Football field background image (base64 SVG)
const footballFieldBase64 = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgODAwIDQwMCI+CiAgPCEtLSBCYWNrZ3JvdW5kIC0tPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMDA4MDAwIiBvcGFjaXR5PSIwLjIiLz4KCiAgPCEtLSBHcmFzcyBwYXR0ZXJuIC0tPgogIDxwYXR0ZXJuIGlkPSJncmFzc1BhdHRlcm4iIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI4MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblRyYW5zZm9ybT0icm90YXRlKDQ1KSI+CiAgICA8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iNDAiIGZpbGw9IiMwMDgwMDAiIG9wYWNpdHk9IjAuMSIvPgogICAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDA5MDAwIiBvcGFjaXR5PSIwLjEiLz4KICA8L3BhdHRlcm4+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9InVybCgjZ3Jhc3NQYXR0ZXJuKSIgb3BhY2l0eT0iMC4zIi8+CgogIDwhLS0gRmllbGQgbWFya2luZ3MgLS0+CiAgPHJlY3QgeD0iNTAiIHk9IjUwIiB3aWR0aD0iNzAwIiBoZWlnaHQ9IjMwMCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiIG9wYWNpdHk9IjAuNCIvPgogIDxsaW5lIHgxPSI0MDAiIHkxPSI1MCIgeDI9IjQwMCIgeTI9IjM1MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuNCIvPgogIDxjaXJjbGUgY3g9IjQwMCIgY3k9IjIwMCIgcj0iNTAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjQiLz4KCiAgPCEtLSBHb2FsIEFyZWFzIC0tPgogIDxyZWN0IHg9IjUwIiB5PSIxMjUiIHdpZHRoPSI1MCIgaGVpZ2h0PSIxNTAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjQiLz4KICA8cmVjdCB4PSI3MDAiIHk9IjEyNSIgd2lkdGg9IjUwIiBoZWlnaHQ9IjE1MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiIG9wYWNpdHk9IjAuNCIvPgoKICA8IS0tIFBlbmFsdHkgQXJlYXMgLS0+CiAgPHJlY3QgeD0iNTAiIHk9IjEwMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIyMDAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjQiLz4KICA8cmVjdCB4PSI2NTAiIHk9IjEwMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIyMDAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjQiLz4KPC9zdmc+Cg==`;

interface DataPoint {
  timestamp: number;
  isAvailable: boolean;
  gameMinute?: string;
}

interface HeartbeatGraphProps {
  eventId: string;
  eventData?: any; // For storing game minute and other event data
}

export default function HeartbeatGraph({ eventId, eventData }: HeartbeatGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'available' | 'suspended' | 'unknown'>('unknown');
  const [currentMinute, setCurrentMinute] = useState<string>('');
  const backgroundImage = useRef<HTMLImageElement | null>(null);
  
  // Preload football field background
  useEffect(() => {
    const img = new Image();
    img.src = footballFieldBase64;
    img.onload = () => {
      backgroundImage.current = img;
      if (data.length > 0) {
        drawHeartbeat();
      }
    };
  }, []);
  
  // Fetch data and set up the canvas
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Always use the live data endpoint
        const endpoint = `/api/live-heartbeat/data/${eventId}`;
        
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        
        const result = await response.json();
        
        // For football matches, we want to show the entire 90 minutes
        // No time range filtering needed as we'll use game minutes instead
        setData(result);
        
        // Determine current status
        if (result.length > 0) {
          const latestData = result[result.length - 1];
          setIsAvailable(latestData.isAvailable);
          setCurrentStatus(latestData.isAvailable ? 'available' : 'suspended');
          
          // Extract game minute if available
          if (latestData.gameMinute) {
            setCurrentMinute(latestData.gameMinute);
          }
        }
        
        setIsLoading(false);
        
        // Draw the heartbeat immediately after data is loaded
        drawHeartbeat();
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsLoading(false);
        setCurrentStatus('unknown');
      }
    };
    
    // Initial data fetch
    fetchData();
    
    // Set up interval for fetching data
    intervalId = setInterval(fetchData, 10000); // Refresh every 10 seconds for live data
    
    // Clean up interval on unmount
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [eventId]);
  
  // Set up canvas and draw heartbeat whenever data changes
  useEffect(() => {
    drawHeartbeat();
  }, [data]);
  
  // Function to draw the heartbeat graph
  function drawHeartbeat() {
    console.log("Drawing heartbeat with data points:", data.length);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas ref is null");
      return;
    }
    
    if (data.length === 0) {
      console.log("No data available to draw");
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Could not get canvas context");
      return;
    }
    
    // Debug canvas dimensions
    console.log(`Canvas dimensions: ${canvas.width} x ${canvas.height}`);
    
    // Get canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw football field background if loaded
    if (backgroundImage.current) {
      ctx.globalAlpha = 0.2; // Make it subtle/blurry
      ctx.drawImage(backgroundImage.current, 0, 0, width, height);
      ctx.globalAlpha = 1.0;
    }
    
    // Draw grid
    drawGrid(ctx, width, height);
    
    // Draw game minute labels
    drawMinuteLabels(ctx, width, height);
    
    // Calculate spacing based on game minutes (1-120)
    const maxGameMinute = 120; // Extended to 120 minutes as requested
    const pixelsPerMinute = width / maxGameMinute;
    
    // Helper function to get the game minute as a number
    const getMinuteNumber = (minuteStr: string | undefined): number => {
      if (!minuteStr) return 0;
      // Extract numeric part from strings like "45'" or "45+2'"
      const match = minuteStr.match(/^(\d+)(?:\+(\d+))?/);
      if (match) {
        const baseMinute = parseInt(match[1], 10);
        const addedTime = match[2] ? parseInt(match[2], 10) : 0;
        return baseMinute + addedTime;
      }
      return 0;
    };
    
    // Find the current game minute - either from data or use latest available
    const extractedMinutes = data
      .map(point => point.gameMinute)
      .filter(minute => minute)
      .map(getMinuteNumber);
    
    // Default to 45 minutes if no game minutes are available
    const currentGameMinute = extractedMinutes.length > 0 
      ? Math.max(...extractedMinutes) 
      : 45;
    
    console.log("Current game minute:", currentGameMinute);
    
    // Set up a completely fixed example heartbeat pattern
    // This ensures we always see something visually on the screen
    // and ensures our drawing is working
    
    // Extremely simple approach - draw a clean heartbeat line
    ctx.lineWidth = 2;  // Thinner line as requested
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Green for normal heartbeat
    ctx.strokeStyle = '#00ff00';
    
    // Draw a series of heartbeats from 0 to current minute
    const beatWidth = 20;  // Width of each heartbeat pattern in pixels
    const beatCount = Math.floor(currentGameMinute * pixelsPerMinute / beatWidth);
    
    console.log(`Drawing ${beatCount} heartbeats`);
    
    ctx.beginPath();
    ctx.moveTo(0, height / 2);  // Start at the left edge, middle height
    
    for (let i = 0; i < beatCount; i++) {
      const x = i * beatWidth;
      
      // Draw baseline up to this beat
      ctx.lineTo(x, height / 2);
      
      // Draw heartbeat pattern (simple ECG-like) with smaller spikes
      ctx.lineTo(x + 5, height / 2 - 3);      // Small P wave (smaller)
      ctx.lineTo(x + 7, height / 2);          // Back to baseline
      ctx.lineTo(x + 9, height / 2 + 3);      // Q dip (smaller)
      ctx.lineTo(x + 10, height / 2 - 25);    // R spike (reduced height)
      ctx.lineTo(x + 12, height / 2 + 5);     // S dip (smaller)
      ctx.lineTo(x + 14, height / 2);         // Back to baseline
      ctx.lineTo(x + 16, height / 2 - 6);     // T wave (smaller)
      ctx.lineTo(x + 18, height / 2);         // Back to baseline
    }
    
    // Draw remaining line to current minute position
    const endX = currentGameMinute * pixelsPerMinute;
    ctx.lineTo(endX, height / 2);
    
    // Stroke the path
    ctx.stroke();
    
    // Draw minute indicator at the current position
    if (currentGameMinute > 0) {
      const minuteX = Math.min(currentGameMinute * pixelsPerMinute, width - 20);
      
      // Draw minute bubble
      ctx.beginPath();
      ctx.arc(minuteX, 20, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff00'; // Always green for visibility
      ctx.fill();
      
      // Draw minute text
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(currentGameMinute.toString(), minuteX, 20);
    }
    
    console.log("Heartbeat drawing completed successfully");
  }
  
  // Function to draw grid on the canvas
  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.lineWidth = 1;
    
    // Draw horizontal grid lines (like in the ECG monitor reference)
    const horizontalCount = 6; // Number of horizontal lines to draw
    const verticalCount = 12; // Number of vertical lines to draw
    
    // First draw darker background grid
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)'; // Very faint green
    
    // Draw horizontal grid lines
    for (let i = 0; i <= horizontalCount; i++) {
      const y = (i / horizontalCount) * height;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    
    // Draw vertical grid lines
    for (let i = 0; i <= verticalCount; i++) {
      const x = (i / verticalCount) * width;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    ctx.stroke();
    
    // Now draw brighter major grid lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)'; // Brighter green
    
    // Draw center line - important for ECG
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    
    // Draw vertical grid lines every 15 minutes of game time (up to 120 minutes)
    for (let minute = 15; minute <= 120; minute += 15) {
      const x = (minute / 120) * width;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    // Draw flatline for no heartbeat at 3/4 height
    ctx.moveTo(0, (height * 3) / 4);
    ctx.lineTo(width, (height * 3) / 4);
    
    ctx.stroke();
  }
  
  // Function to draw minute labels
  function drawMinuteLabels(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.font = '10px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    
    // Draw minute labels every 15 minutes (up to 120 minutes)
    for (let minute = 0; minute <= 120; minute += 15) {
      const x = (minute / 120) * width;
      ctx.fillText(`${minute}'`, x, height - 5);
    }
  }
  
  // Function to save canvas as image
  const saveCanvasAsImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `heartbeat-${eventId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.href = dataUrl;
    link.click();
  };
  
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span>Match Heartbeat</span>
            
            {isLoading ? (
              <Skeleton className="h-5 w-16 ml-2" />
            ) : (
              <Badge 
                variant={currentStatus === 'available' ? 'outline' : 
                         currentStatus === 'suspended' ? 'destructive' : 'outline'}
                className={`ml-2 ${currentStatus === 'available' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : ''}`}
              >
                {currentStatus === 'available' ? 'Available' : 
                 currentStatus === 'suspended' ? 'Suspended' : 'Unknown'}
              </Badge>
            )}
            
            {currentMinute && (
              <Badge variant="secondary" className="ml-2">
                {currentMinute}
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={saveCanvasAsImage}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="w-full h-48 flex items-center justify-center bg-gray-50 dark:bg-slate-900 rounded-md">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="w-full h-48 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 rounded-md">
            <BarChart className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No data available yet</p>
          </div>
        ) : (
          <div className="w-full rounded-md overflow-hidden" 
               style={{ backgroundColor: '#002211' }}>
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={200} 
              className="w-full h-48 border border-gray-100/10 rounded-md"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}