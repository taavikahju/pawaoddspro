import React, { useEffect, useRef, useState } from 'react';
import { Activity, BarChart, ZoomIn, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface DataPoint {
  timestamp: number;
  isAvailable: boolean;
}

interface HeartbeatGraphProps {
  eventId: string;
  historical?: boolean;
}

export default function HeartbeatGraph({ eventId, historical = false }: HeartbeatGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '3h' | '6h' | '12h' | '24h'>('1h');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [toggleSound, setToggleSound] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentStatus, setCurrentStatus] = useState<'available' | 'suspended' | 'unknown'>('unknown');
  
  // Fetch data and set up the canvas
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Determine the API endpoint based on whether we're viewing historical data
        const endpoint = historical 
          ? `/api/live-heartbeat/history/${eventId}` 
          : `/api/live-heartbeat/data/${eventId}`;
        
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        
        const result = await response.json();
        
        // Filter data based on time range
        const now = Date.now();
        let timeRangeInMs = 3600000; // default 1h
        
        switch (timeRange) {
          case '3h':
            timeRangeInMs = 3 * 3600000;
            break;
          case '6h':
            timeRangeInMs = 6 * 3600000;
            break;
          case '12h':
            timeRangeInMs = 12 * 3600000;
            break;
          case '24h':
            timeRangeInMs = 24 * 3600000;
            break;
        }
        
        const filteredData = result.filter((point: DataPoint) => {
          return now - point.timestamp < timeRangeInMs;
        });
        
        setData(filteredData);
        
        // Determine current status
        if (filteredData.length > 0) {
          const latestData = filteredData[filteredData.length - 1];
          setIsAvailable(latestData.isAvailable);
          setCurrentStatus(latestData.isAvailable ? 'available' : 'suspended');
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
    
    // Set up interval for fetching data in non-historical mode
    if (!historical) {
      intervalId = setInterval(fetchData, 10000); // Refresh every 10 seconds for live data
    }
    
    // Play beep sound based on current availability status and toggle state
    if (toggleSound && isAvailable !== null) {
      playBeep();
    }
    
    // Clean up interval on unmount
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [eventId, historical, timeRange, toggleSound]);
  
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
    
    // Draw grid
    drawGrid(ctx, width, height);
    
    // Draw time labels
    drawTimeLabels(ctx, width, height, data);
    
    // Draw status indicator
    if (isAvailable !== null) {
      drawStatusIndicator(ctx, width, height, isAvailable);
    }
    
    // Calculate spacing
    const spacing = width / (data.length === 1 ? 2 : data.length - 1);
    
    // Setup heartbeat line style
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw heartbeat line
    ctx.beginPath();
    
    // Start at the left side
    ctx.moveTo(0, height / 2);
    
    // Draw the heartbeat for each data point
    data.forEach((point, index) => {
      const x = index * spacing;
      let y;
      
      if (point.isAvailable) {
        // For available status, draw a heartbeat peak
        y = height / 4; // Peak goes up 1/4th of the height from the center
      } else {
        // For unavailable status, draw a heartbeat drop
        y = (3 * height) / 4; // Drop goes down 1/4th of the height from the center
      }
      
      // Draw line to current point
      ctx.lineTo(x, y);
      
      // If not the last point, draw line back to center before next point
      if (index < data.length - 1) {
        ctx.lineTo(x + spacing / 2, height / 2);
      }
    });
    
    // If there's only one data point, continue to the right edge
    if (data.length === 1) {
      ctx.lineTo(width, height / 2);
    }
    
    // Set line color based on latest status
    if (data.length > 0) {
      const latestStatus = data[data.length - 1].isAvailable;
      ctx.strokeStyle = latestStatus ? '#22c55e' : '#f43f5e';
    } else {
      ctx.strokeStyle = '#94a3b8';
    }
    
    ctx.stroke();
  }
  
  // Function to draw grid on the canvas
  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Draw horizontal center line
    ctx.beginPath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw vertical grid lines every 5 minutes
    const timeIntervalMinutes = 5;
    const timeIntervalMs = timeIntervalMinutes * 60 * 1000;
    const now = Date.now();
    
    // Calculate how many intervals fit in the current time range
    let timeRangeInMs = 3600000; // default 1h
    switch (timeRange) {
      case '3h':
        timeRangeInMs = 3 * 3600000;
        break;
      case '6h':
        timeRangeInMs = 6 * 3600000;
        break;
      case '12h':
        timeRangeInMs = 12 * 3600000;
        break;
      case '24h':
        timeRangeInMs = 24 * 3600000;
        break;
    }
    
    const numIntervals = timeRangeInMs / timeIntervalMs;
    const pixelsPerInterval = width / numIntervals;
    
    ctx.beginPath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    
    for (let i = 1; i < numIntervals; i++) {
      const x = i * pixelsPerInterval;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    ctx.stroke();
  }
  
  // Function to draw time labels
  function drawTimeLabels(ctx: CanvasRenderingContext2D, width: number, height: number, data: DataPoint[]) {
    if (data.length === 0) return;
    
    ctx.font = '10px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    
    // Draw labels for start, middle, and end times
    const startTime = new Date(data[0].timestamp);
    const endTime = new Date(data[data.length - 1].timestamp);
    const middleTime = new Date((startTime.getTime() + endTime.getTime()) / 2);
    
    // Format times as HH:MM
    const formatTime = (date: Date) =>
      date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    
    ctx.fillText(formatTime(startTime), 30, height - 5);
    ctx.fillText(formatTime(middleTime), width / 2, height - 5);
    ctx.fillText(formatTime(endTime), width - 30, height - 5);
  }
  
  // Function to display current status indicator
  function drawStatusIndicator(ctx: CanvasRenderingContext2D, width: number, height: number, isAvailable: boolean) {
    const radius = 6;
    const x = width - radius - 10;
    const y = radius + 10;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isAvailable ? '#22c55e' : '#f43f5e';
    ctx.fill();
  }
  
  // Function to play beep sound
  function playBeep() {
    if (!audioRef.current) return;
    
    // Create audio element for heartbeat beep
    audioRef.current = new Audio();
    // Using a simple beep sound (short audio data)
    audioRef.current.src = 'data:audio/wav;base64,UklGRl9vT19CRUdJTk5JTkdfT0ZfQVVESU9fREFUQQ==';
    
    // Set volume and play
    audioRef.current.volume = 0.3;
    audioRef.current.play().catch(err => console.error('Error playing sound:', err));
  }
  
  // Handle time range change
  const handleTimeRangeChange = (value: string) => {
    if (value === '1h' || value === '3h' || value === '6h' || value === '12h' || value === '24h') {
      setTimeRange(value);
    }
  };
  
  // Handle sound toggle
  const handleSoundToggle = () => {
    setToggleSound(!toggleSound);
  };
  
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
            <span>Heartbeat Monitor</span>
            
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
          </CardTitle>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSoundToggle}
              className={toggleSound ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : ''}
            >
              {toggleSound ? 'Sound On' : 'Sound Off'}
            </Button>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={saveCanvasAsImage}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <ToggleGroup 
          type="single" 
          value={timeRange} 
          onValueChange={handleTimeRangeChange}
          className="justify-start mt-2"
        >
          <ToggleGroupItem value="1h" size="sm" className="text-xs px-2 py-1 h-7">1h</ToggleGroupItem>
          <ToggleGroupItem value="3h" size="sm" className="text-xs px-2 py-1 h-7">3h</ToggleGroupItem>
          <ToggleGroupItem value="6h" size="sm" className="text-xs px-2 py-1 h-7">6h</ToggleGroupItem>
          <ToggleGroupItem value="12h" size="sm" className="text-xs px-2 py-1 h-7">12h</ToggleGroupItem>
          <ToggleGroupItem value="24h" size="sm" className="text-xs px-2 py-1 h-7">24h</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="w-full h-48 flex items-center justify-center bg-gray-50 dark:bg-slate-900 rounded-md">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="w-full h-48 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 rounded-md">
            <BarChart className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No data available for this time range</p>
          </div>
        ) : (
          <div className="w-full bg-white dark:bg-slate-900 rounded-md overflow-hidden">
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={200} 
              className="w-full h-48 border border-gray-100 dark:border-slate-800 rounded-md"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}