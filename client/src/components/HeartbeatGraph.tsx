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
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
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
    
    const currentGameMinute = extractedMinutes.length > 0 
      ? Math.max(...extractedMinutes) 
      : 0;
    
    // Start from left side (0 minute) to current game minute
    const endX = Math.min(currentGameMinute * pixelsPerMinute, width);
    
    // Setup heartbeat line style with thinner line (like in the drawing)
    ctx.lineWidth = 2; 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Sort data points by minute for sequential processing
    const sortedData = [...data].sort((a, b) => {
      const minA = getMinuteNumber(a.gameMinute) || 0;
      const minB = getMinuteNumber(b.gameMinute) || 0;
      return minA - minB;
    });
    
    // Group the data by availability status to find change points
    let currentStatus = sortedData.length > 0 ? sortedData[0].isAvailable : true;
    let lastStatusChangeMinute = 0;
    
    // This will track the sequences of available/unavailable periods
    const statusSegments: Array<{
      startMinute: number;
      endMinute: number;
      isAvailable: boolean;
    }> = [];
    
    // Add the initial status
    if (sortedData.length > 0) {
      // Find the status changes
      for (let i = 0; i < sortedData.length; i++) {
        const point = sortedData[i];
        const minute = getMinuteNumber(point.gameMinute) || 0;
        
        // If status changed, add a segment
        if (point.isAvailable !== currentStatus || i === sortedData.length - 1) {
          // Add the segment that just ended
          statusSegments.push({
            startMinute: lastStatusChangeMinute,
            endMinute: minute,
            isAvailable: currentStatus
          });
          
          // Update for the next segment
          currentStatus = point.isAvailable;
          lastStatusChangeMinute = minute;
        }
      }
      
      // Make sure we add the final segment to the current minute
      if (lastStatusChangeMinute < currentGameMinute) {
        statusSegments.push({
          startMinute: lastStatusChangeMinute,
          endMinute: currentGameMinute,
          isAvailable: currentStatus
        });
      }
    } else {
      // If no data, just add one segment
      statusSegments.push({
        startMinute: 0,
        endMinute: currentGameMinute || 10, // Default to 10 if no data
        isAvailable: true
      });
    }
    
    // Now draw each segment
    for (const segment of statusSegments) {
      const startX = segment.startMinute * pixelsPerMinute;
      const segmentEndX = segment.endMinute * pixelsPerMinute;
      
      // Set color based on segment status
      const segmentColor = segment.isAvailable ? '#00ff00' : '#ff3333';
      
      ctx.beginPath();
      ctx.strokeStyle = segmentColor;
      
      // Start at middle for available, or bottom for unavailable
      const baselineY = segment.isAvailable ? height / 2 : (height * 3) / 4;
      ctx.moveTo(startX, baselineY);
      
      if (segment.isAvailable) {
        // Draw ECG pattern for available segments with more natural look
        // (more like your drawing)
        const beatWidth = 30; // Width of each heartbeat
        const startBeat = Math.floor(startX / beatWidth);
        const endBeat = Math.ceil(segmentEndX / beatWidth);
        
        // Draw each individual beat in the segment
        for (let beat = startBeat; beat < endBeat; beat++) {
          const beatStartX = Math.max(beat * beatWidth, startX);
          const beatEndX = Math.min((beat + 1) * beatWidth, segmentEndX);
          
          if (beatEndX <= beatStartX) continue;
          
          // Calculate position within the beat (0 to 1)
          const beatPoints = [];
          const pointCount = Math.max(5, Math.floor((beatEndX - beatStartX) / 3));
          
          for (let i = 0; i <= pointCount; i++) {
            const x = beatStartX + (beatEndX - beatStartX) * (i / pointCount);
            const position = (x - beat * beatWidth) / beatWidth;
            
            let y;
            if (position < 0.25) {
              // Initial flat part (with small variation)
              y = baselineY + Math.sin(position * 10) * 2;
            } else if (position < 0.35) {
              // Upward spike
              const progress = (position - 0.25) / 0.1;
              y = baselineY - Math.pow(progress, 0.8) * 80;
            } else if (position < 0.45) {
              // Downward after spike
              const progress = (position - 0.35) / 0.1;
              y = baselineY - 80 + Math.pow(progress, 0.7) * 95;
            } else if (position < 0.55) {
              // S wave (dip below baseline)
              y = baselineY + 15 - Math.cos((position - 0.45) * Math.PI * 5) * 10;
            } else if (position < 0.8) {
              // Return to and small T wave
              y = baselineY - Math.sin((position - 0.55) * Math.PI * 1.5) * 12;
            } else {
              // Rest of baseline
              y = baselineY + Math.sin(position * 15) * 1.5;
            }
            
            beatPoints.push({ x, y });
          }
          
          // Draw the points for this beat
          if (beatPoints.length > 0) {
            ctx.moveTo(beatPoints[0].x, beatPoints[0].y);
            for (let i = 1; i < beatPoints.length; i++) {
              ctx.lineTo(beatPoints[i].x, beatPoints[i].y);
            }
          }
        }
      } else {
        // For unavailable segments, draw a flat line with small variations
        for (let x = startX; x <= segmentEndX; x += 3) {
          const y = baselineY + (Math.sin(x * 0.1) * 2);
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    // Draw minute indicator at the current position
    if (currentGameMinute > 0) {
      const minuteX = Math.min(currentGameMinute * pixelsPerMinute, width - 5);
      
      // Draw minute bubble
      ctx.beginPath();
      ctx.arc(minuteX, 20, 15, 0, Math.PI * 2);
      
      // Use the current status color
      const currentStatusColor = currentStatus ? '#00ff00' : '#ff3333';
      ctx.fillStyle = currentStatusColor;
      ctx.fill();
      
      // Draw minute text
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(currentGameMinute.toString(), minuteX, 20);
    }
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