import React, { useEffect, useRef, useState } from 'react';
import { Activity, BarChart, Loader2, Heart, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import ReactCountryFlag from 'react-country-flag';

// Football field background image (base64 SVG)
const footballFieldBase64 = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgODAwIDQwMCI+CiAgPCEtLSBCYWNrZ3JvdW5kIC0tPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMDA4MDAwIiBvcGFjaXR5PSIwLjIiLz4KCiAgPCEtLSBHcmFzcyBwYXR0ZXJuIC0tPgogIDxwYXR0ZXJuIGlkPSJncmFzc1BhdHRlcm4iIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI4MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblRyYW5zZm9ybT0icm90YXRlKDQ1KSI+CiAgICA8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iNDAiIGZpbGw9IiMwMDgwMDAiIG9wYWNpdHk9IjAuMSIvPgogICAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMDA5MDAwIiBvcGFjaXR5PSIwLjEiLz4KICA8L3BhdHRlcm4+CiAgPHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9InVybCgjZ3Jhc3NQYXR0ZXJuKSIgb3BhY2l0eT0iMC4zIi8+CgogIDwhLS0gRmllbGQgbWFya2luZ3MgLS0+CiAgPHJlY3QgeD0iNTAiIHk9IjUwIiB3aWR0aD0iNzAwIiBoZWlnaHQ9IjMwMCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiIG9wYWNpdHk9IjAuNCIvPgogIDxsaW5lIHgxPSI0MDAiIHkxPSI1MCIgeDI9IjQwMCIgeTI9IjM1MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuNCIvPgogIDxjaXJjbGUgY3g9IjQwMCIgY3k9IjIwMCIgcj0iNTAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjQiLz4KCiAgPCEtLSBHb2FsIEFyZWFzIC0tPgogIDxyZWN0IHg9IjUwIiB5PSIxMjUiIHdpZHRoPSI1MCIgaGVpZ2h0PSIxNTAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjQiLz4KICA8cmVjdCB4PSI3MDAiIHk9IjEyNSIgd2lkdGg9IjUwIiBoZWlnaHQ9IjE1MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiIG9wYWNpdHk9IjAuNCIvPgoKICA8IS0tIFBlbmFsdHkgQXJlYXMgLS0+CiAgPHJlY3QgeD0iNTAiIHk9IjEwMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIyMDAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjQiLz4KICA8cmVjdCB4PSI2NTAiIHk9IjEwMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIyMDAiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBvcGFjaXR5PSIwLjQiLz4KPC9zdmc+Cg==`;

interface DataPoint {
  timestamp: number;
  isAvailable: boolean;
  gameMinute?: string;
  time?: string; // ISO string timestamp
}

interface HeartbeatStats {
  uptimePercentage: number;
  availableDurationMinutes: number;
  suspendedDurationMinutes: number;
  totalDurationMinutes: number;
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
  const [stats, setStats] = useState<HeartbeatStats>({
    uptimePercentage: 0,
    availableDurationMinutes: 0,
    suspendedDurationMinutes: 0,
    totalDurationMinutes: 0
  });
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
  
  // State to store event details
  const [eventDetails, setEventDetails] = useState<{
    name: string;
    homeTeam?: string;
    awayTeam?: string;
    gameMinute?: string;
    country?: string;
    tournament?: string;
  } | null>(null);

  // Fetch data and set up the canvas
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Always use the live data endpoint
        const endpoint = `/api/live-heartbeat/data/${eventId}`;
        console.log(`Fetching live heartbeat data for event ID: ${eventId}`);
        
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        
        const result = await response.json();
        console.log(`Received heartbeat data:`, result);
        
        // Also fetch event details from the status endpoint
        try {
          const statusResponse = await fetch('/api/live-heartbeat/status');
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log(`Received status data containing ${statusData.events?.length || 0} events`);
            
            const event = statusData.events?.find((e: any) => e.id === eventId);
            if (event) {
              console.log(`Found matching event in status data:`, event);
              setEventDetails({
                name: event.name,
                homeTeam: event.homeTeam,
                awayTeam: event.awayTeam,
                gameMinute: event.gameMinute,
                country: event.country,
                tournament: event.tournament
              });
              
              if (event.gameMinute) {
                console.log(`Setting current minute to: ${event.gameMinute}`);
                setCurrentMinute(event.gameMinute);
              }
            } else {
              console.log(`No matching event found in status data for ID: ${eventId}`);
            }
          }
        } catch (error) {
          console.error('Error fetching event details:', error);
        }
        
        // Process the result data based on its structure
        let timestamps: DataPoint[] = [];
        
        if (result) {
          // Check if result is directly an array of data points
          if (Array.isArray(result)) {
            console.log(`Result is a direct array with ${result.length} data points`);
            timestamps = result.map(item => {
              // Make sure each item has all necessary properties
              if (!item.hasOwnProperty('isAvailable')) {
                console.log(`Data point missing isAvailable property, setting to true by default:`, item);
                item.isAvailable = true;
              }
              
              // Add gameMinute from event details if the data point doesn't have one
              if (!item.gameMinute && eventDetails && eventDetails.gameMinute) {
                console.log(`Adding gameMinute ${eventDetails.gameMinute} to data point`);
                item.gameMinute = eventDetails.gameMinute;
              }
              
              return item;
            });
          } 
          // Check if result has a timestamps array property
          else if (result.timestamps && Array.isArray(result.timestamps)) {
            console.log(`Result contains a timestamps array with ${result.timestamps.length} data points`);
            
            timestamps = result.timestamps.map((item: any) => {
              // Make sure each item has all necessary properties
              if (!item.hasOwnProperty('isAvailable')) {
                console.log(`Data point missing isAvailable property, setting to true by default:`, item);
                item.isAvailable = true;
              }
              
              // Add gameMinute from event details if the data point doesn't have one
              if (!item.gameMinute && eventDetails && eventDetails.gameMinute) {
                console.log(`Adding gameMinute ${eventDetails.gameMinute} to data point`);
                item.gameMinute = eventDetails.gameMinute;
              }
              
              return item;
            });
          }
          // Otherwise create an empty array (will be populated with sample data if needed)
          else {
            console.log(`Result has an unexpected format, creating empty array`);
            timestamps = [];
          }
        }
        
        // Update the state with the processed data
        console.log(`Setting data state with ${timestamps.length} timestamps`);
        setData(timestamps);
        
        // Determine current status from the latest data point
        if (timestamps.length > 0) {
          const latestData = timestamps[timestamps.length - 1];
          console.log(`Latest data point:`, latestData);
          
          setIsAvailable(latestData.isAvailable);
          setCurrentStatus(latestData.isAvailable ? 'available' : 'suspended');
          
          // Extract game minute if available
          if (latestData.gameMinute) {
            console.log(`Data point has game minute: ${latestData.gameMinute}`);
            setCurrentMinute(latestData.gameMinute);
          }
        } else {
          console.log(`No data points available to determine current status`);
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
    
    // Work with a copy of the data to ensure we don't modify the original
    let timestamps = [...data].sort((a, b) => a.timestamp - b.timestamp);
    console.log(`Data points available: ${timestamps.length}`);
    
    // Calculate the elapsed time in minutes based on the first and last data points
    let elapsedMinutes = 0;
    
    if (timestamps.length >= 2) {
      const firstTimestamp = timestamps[0].timestamp;
      const lastTimestamp = timestamps[timestamps.length - 1].timestamp;
      
      // Calculate the difference in milliseconds and convert to minutes
      const diffMs = lastTimestamp - firstTimestamp;
      elapsedMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      
      console.log(`Time elapsed between first and last data point: ${elapsedMinutes} minutes`);
    }
    
    // Display empty state message if no data is available
    if (timestamps.length === 0) {
      console.log("No data available, showing empty state");
      
      // Draw grid lines anyway to show the background
      drawGrid(ctx, width, height);
      drawMinuteLabels(ctx, width, height);
      
      // Draw empty state message
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for live data...', width / 2, height / 2);
      
      // Early return since we can't draw a heartbeat without data
      return;
    }
    
    // Find the current game minute from elapsed time
    // In this new version, we use the actual elapsed time but keep the UI visually the same
    let currentGameMinute = elapsedMinutes > 0 ? Math.min(elapsedMinutes, 120) : 45; // Default to 45 minutes if no data
    
    // We'll still use the game minute from event details for display purposes only, not for graph width
    if (eventDetails && eventDetails.gameMinute) {
      console.log(`Event game minute from details: ${eventDetails.gameMinute} (using elapsed time ${elapsedMinutes} for graph width)`);
    }
    
    console.log("Current game minute (based on elapsed time):", currentGameMinute);
    
    // Set up the drawing style
    ctx.lineWidth = 2;  // Thinner line as requested
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Green for normal heartbeat
    ctx.strokeStyle = '#00ff00';
    
    // Draw a series of heartbeats from 0 to current minute with reduced frequency
    const beatWidth = 40;  // Doubled width to reduce frequency (was 20)
    // Ensure we draw heartbeats up to the exact current game minute
    const beatCount = Math.ceil(currentGameMinute * pixelsPerMinute / beatWidth);
    
    console.log(`Drawing ${beatCount} heartbeats`);
    
    // Start the drawing path
    ctx.beginPath();
    ctx.moveTo(0, height / 2);  // Start at the left edge, middle height
    
    // Calculate how many beats to show based on available game minutes
    const availableBeats = Math.ceil(currentGameMinute);
    const beatsToShow = Math.min(beatCount, availableBeats);
    
    console.log(`Drawing ${beatsToShow} beats for ${currentGameMinute} game minutes`);
    
    // Track the current market status to detect changes
    let currentlyAvailable = true; // Default status (will be updated with real data)
    
    // First check if we have a current availability status from the last data point
    if (timestamps.length > 0) {
      currentlyAvailable = timestamps[timestamps.length - 1].isAvailable;
    }
    
    for (let i = 0; i < beatsToShow; i++) {
      const x = i * beatWidth;
      
      // Calculate which game minute this heartbeat represents
      const currentBeatMinute = Math.floor(x / pixelsPerMinute);
      
      // Find the market status for this minute by searching through timestamps
      let marketAvailable = currentlyAvailable;
      
      // If we have timestamps, use the availability status from the appropriate timestamp
      if (i % 3 === 0 && timestamps.length > 0) { // Only check every 3rd beat to avoid too many status changes
        // Get a timestamp index based on our position in the game
        const timestampIndex = Math.min(
          Math.floor((i / beatsToShow) * timestamps.length), 
          timestamps.length - 1
        );
        marketAvailable = timestamps[timestampIndex].isAvailable;
      }
      
      // If market status changed, end current path and start a new one with different color
      if (marketAvailable !== currentlyAvailable) {
        ctx.stroke(); // End current path
        ctx.beginPath(); // Start new path
        ctx.strokeStyle = marketAvailable ? '#00ff00' : '#ff3333'; // Green for available, red for suspended
        ctx.moveTo(x, height / 2); // Continue from same position
        currentlyAvailable = marketAvailable; // Update the status
      }
      
      if (!marketAvailable) {
        // For suspended markets, draw a flat line
        const endX = Math.min(x + beatWidth, currentGameMinute * pixelsPerMinute);
        ctx.lineTo(endX, height / 2); // Flat line for suspended
      } else {
        // Regular heartbeat pattern for available markets
        // Draw baseline up to this beat
        ctx.lineTo(x, height / 2);
        
        // Draw heartbeat pattern (simple ECG-like) with smaller spikes
        ctx.lineTo(x + 10, height / 2 - 3);      // Small P wave (smaller)
        ctx.lineTo(x + 14, height / 2);          // Back to baseline
        ctx.lineTo(x + 18, height / 2 + 3);      // Q dip (smaller)
        ctx.lineTo(x + 20, height / 2 - 20);     // R spike (reduced height)
        ctx.lineTo(x + 24, height / 2 + 5);      // S dip (smaller)
        ctx.lineTo(x + 28, height / 2);          // Back to baseline
        ctx.lineTo(x + 32, height / 2 - 5);      // T wave (smaller)
        ctx.lineTo(x + 36, height / 2);          // Back to baseline
      }
    }
    
    // Draw remaining line to current minute position
    const endX = currentGameMinute * pixelsPerMinute;
    ctx.lineTo(endX, height / 2);
    
    // Stroke the path
    ctx.stroke();
    
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
  
  // Calculate statistics based on the collected data
  useEffect(() => {
    if (data.length > 0) {
      // Calculate statistics from the data points
      const calculateStats = () => {
        // Count data points by availability status
        let availableCount = 0;
        let suspendedCount = 0;
        
        data.forEach(point => {
          if (point.isAvailable) {
            availableCount++;
          } else {
            suspendedCount++;
          }
        });
        
        // We estimate each data point represents approximately 10 seconds
        const secondsPerDataPoint = 10;
        
        // Calculate durations in minutes
        const availableMinutes = (availableCount * secondsPerDataPoint) / 60;
        const suspendedMinutes = (suspendedCount * secondsPerDataPoint) / 60;
        const totalMinutes = availableMinutes + suspendedMinutes;
        
        // Calculate uptime percentage based on time (available ÷ total)
        const uptime = totalMinutes > 0 
          ? (availableMinutes / totalMinutes) * 100
          : 0;
          
        // Return the calculated statistics with 1 decimal place precision
        return {
          uptimePercentage: Number(uptime.toFixed(1)),
          availableDurationMinutes: Number(availableMinutes.toFixed(1)),
          suspendedDurationMinutes: Number(suspendedMinutes.toFixed(1)),
          totalDurationMinutes: Number(totalMinutes.toFixed(1))
        };
      };
      
      // Update the stats state
      const newStats = calculateStats();
      setStats(newStats);
      
      // Send stats to server for historical analytics
      const storeStats = async () => {
        try {
          // Get admin key from localStorage if available
          const adminKey = localStorage.getItem('adminKey');
          
          // Current date components for time-based filtering
          const now = new Date();
          const day = now.toISOString().split('T')[0]; // YYYY-MM-DD
          const week = `${now.getFullYear()}-W${Math.ceil((now.getDate() + now.getDay()) / 7)}`;
          const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          
          const response = await fetch(`/api/live-heartbeat/stats`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(adminKey ? { 'x-admin-key': adminKey } : {})
            },
            body: JSON.stringify({
              eventId,
              timestamp: Date.now(),
              // Convert to integers for database compatibility
              uptimePercentage: Math.round(newStats.uptimePercentage),
              availableDurationMinutes: Math.round(newStats.availableDurationMinutes),
              suspendedDurationMinutes: Math.round(newStats.suspendedDurationMinutes),
              totalDurationMinutes: Math.round(newStats.totalDurationMinutes),
              day,
              week,
              month
            })
          });
          
          if (response.ok) {
            console.log("⚡ Heartbeat stats successfully stored to database");
          } else {
            console.error("Failed to store heartbeat stats:", await response.text());
          }
        } catch (error) {
          console.error("Failed to store heartbeat statistics:", error);
        }
      };
      
      storeStats();
    }
  }, [data, eventId]);
  
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {!eventDetails ? (
                  "Loading event details..."
                ) : eventDetails.homeTeam && eventDetails.awayTeam && 
                   eventDetails.homeTeam !== "Home" && eventDetails.homeTeam !== "Unknown" &&
                   eventDetails.awayTeam !== "Away" && eventDetails.awayTeam !== "Unknown" ? (
                  `${eventDetails.homeTeam} vs ${eventDetails.awayTeam}`
                ) : eventDetails.name && 
                   eventDetails.name !== "Home vs Away" && 
                   eventDetails.name !== "Unknown vs Unknown" &&
                   eventDetails.name !== "Match Details Unavailable" ? (
                  eventDetails.name
                ) : (
                  `Match from ${eventDetails.tournament || eventDetails.country || "Unknown League"}`
                )}
                
              </span>
            </div>
          </CardTitle>
          
          {/* Stats badge is shown here instead of the download button */}
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-green-50/10 text-green-400 border-green-800">
              Uptime {stats.uptimePercentage}%
            </Badge>
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
      
      {/* Add CardFooter with heartbeat statistics */}
      <CardFooter className="pt-0 pb-3 border-t border-gray-100/10">
        <div className="flex flex-wrap items-center justify-between w-full gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-green-500" />
            <span className="text-green-400">
              {stats.availableDurationMinutes.toFixed(1)} min available
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-red-400">
              {stats.suspendedDurationMinutes.toFixed(1)} min suspended
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Total time: {stats.totalDurationMinutes.toFixed(1)} min
            </Badge>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}