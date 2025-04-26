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
        let processedData: DataPoint[] = [];
        
        if (result) {
          // Check if result is directly an array of data points
          if (Array.isArray(result)) {
            console.log(`Result is a direct array with ${result.length} data points`);
            processedData = result.map(item => {
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
            
            processedData = result.timestamps.map((item: any) => {
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
            processedData = [];
          }
        }
        
        // Update the state with the processed data
        console.log(`Setting data state with ${processedData.length} data points`);
        setData(processedData);
        
        // Determine current status from the latest data point
        if (processedData.length > 0) {
          const latestData = processedData[processedData.length - 1];
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
  
  // Main drawing function
  function drawHeartbeat() {
    console.log("Drawing heartbeat with data points:", data.length);
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas ref is null");
      return;
    }
    
    if (data.length === 0) {
      console.log("No data available to draw");
      // We'll still draw a sample pattern below
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
    
    // Make a working copy of our data points for rendering
    const renderData = [...data];
    
    // Sort data by timestamp (just to be safe)
    renderData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Create sample data if we don't have any real data yet
    if (renderData.length === 0) {
      console.log("No data available, creating sample data for visualization");
      
      // Create a series of timestamps over the last 10 minutes to show something
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        renderData.push({
          timestamp: now - (20 - i) * 30000, // Every 30 seconds, most recent last
          isAvailable: i % 3 !== 0 // Make 2/3 of points available for a realistic pattern
        });
      }
      console.log(`Created ${renderData.length} sample data points`);
    }
    
    // Find the earliest and latest timestamps to calculate the time range
    const earliestTimestamp = renderData.length > 0 ? renderData[0].timestamp : Date.now() - 3600000; // 1 hour ago default
    const latestTimestamp = renderData.length > 0 ? renderData[renderData.length - 1].timestamp : Date.now();
    
    // Calculate time range in milliseconds
    const timeRange = latestTimestamp - earliestTimestamp;
    
    // Calculate pixels per millisecond
    const pixelsPerMs = timeRange > 0 ? width / timeRange : 0.001; // Default small value if no range
    
    console.log(`Time range: ${timeRange}ms, from ${new Date(earliestTimestamp).toISOString()} to ${new Date(latestTimestamp).toISOString()}`);
    console.log(`Pixels per ms: ${pixelsPerMs}`);
    
    // We'll still keep track of game minute for display purposes
    let currentGameMinute = ""; 
    
    // First try to get the game minute from the current event data for display
    if (eventDetails && eventDetails.gameMinute) {
      console.log(`Using game minute from event details: ${eventDetails.gameMinute}`);
      currentGameMinute = eventDetails.gameMinute;
    } else if (renderData.length > 0 && renderData[renderData.length - 1].gameMinute) {
      // As a fallback, use the game minute from the latest timestamp
      currentGameMinute = renderData[renderData.length - 1].gameMinute || "";
    }
    
    console.log("Current game minute:", currentGameMinute);
    
    // Set up drawing parameters
    // Extremely simple approach - draw a clean heartbeat line
    ctx.lineWidth = 2;  // Thinner line as requested
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Green for normal heartbeat
    ctx.strokeStyle = '#00ff00';
    
    // Define the heartbeat pattern size in pixels
    const heartbeatPatternWidth = 40; // Width in pixels for a single heartbeat
    
    // Calculate the number of heartbeats based on the time range
    // We want to show a beat approximately every 20 seconds
    const beatInterval = 20000; // ms between each heartbeat
    const totalBeats = Math.ceil(timeRange / beatInterval);
    
    console.log(`Drawing ${totalBeats} beats for time range of ${timeRange / 1000} seconds`);
    
    // Start drawing from the left edge
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    
    // Process actual data points to create a continuous line
    if (renderData.length > 1) {
      for (let i = 0; i < renderData.length; i++) {
        const dataPoint = renderData[i];
        
        // Calculate x position based on timestamp
        const x = Math.round((dataPoint.timestamp - earliestTimestamp) * pixelsPerMs);
        
        // If this is the first point or status changed, we need to handle it specially
        if (i === 0 || dataPoint.isAvailable !== renderData[i-1].isAvailable) {
          // If not the first point, complete previous path before changing color
          if (i > 0) {
            ctx.lineTo(x, height / 2); // Draw straight line to the status change point
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, height / 2);
          }
          
          // Set the appropriate color based on availability
          ctx.strokeStyle = dataPoint.isAvailable ? '#00ff00' : '#ff3333';
        }
        
        // For suspended markets (not available), just draw a straight line
        if (!dataPoint.isAvailable) {
          if (i < renderData.length - 1) {
            const nextX = Math.round((renderData[i+1].timestamp - earliestTimestamp) * pixelsPerMs);
            ctx.lineTo(nextX, height / 2);
          } else {
            ctx.lineTo(width, height / 2); // To the end if it's the last point
          }
        } 
        // For available markets, draw a heartbeat pattern
        else {
          // Skip drawing heartbeats if points are too close together (prevents overcrowding)
          if (i > 0) {
            const prevX = Math.round((renderData[i-1].timestamp - earliestTimestamp) * pixelsPerMs);
            const distance = x - prevX;
            
            // Only draw heartbeat pattern if there's enough space
            if (distance >= heartbeatPatternWidth) {
              // How many beats can fit in this distance
              const beatsToFit = Math.floor(distance / heartbeatPatternWidth);
              
              for (let beat = 0; beat < beatsToFit; beat++) {
                const beatX = prevX + (beat * heartbeatPatternWidth);
                
                // Draw baseline up to this beat
                ctx.lineTo(beatX, height / 2);
                
                // Draw heartbeat pattern (simple ECG-like) with smaller spikes
                ctx.lineTo(beatX + 10, height / 2 - 3);      // Small P wave
                ctx.lineTo(beatX + 14, height / 2);          // Back to baseline
                ctx.lineTo(beatX + 18, height / 2 + 3);      // Q dip
                ctx.lineTo(beatX + 20, height / 2 - 20);     // R spike
                ctx.lineTo(beatX + 24, height / 2 + 5);      // S dip
                ctx.lineTo(beatX + 28, height / 2);          // Back to baseline
                ctx.lineTo(beatX + 32, height / 2 - 5);      // T wave
                ctx.lineTo(beatX + 36, height / 2);          // Back to baseline
              }
              
              // Complete to the current point
              ctx.lineTo(x, height / 2);
            } else {
              // Just draw a straight line if too crowded
              ctx.lineTo(x, height / 2);
            }
          }
        }
      }
    } 
    // If no data points, create a sample pattern just to show something
    else {
      // Sample spacing for the canvas width
      const sampleBeats = 10;
      for (let i = 0; i < sampleBeats; i++) {
        const beatX = (i * width) / sampleBeats;
        
        // Draw baseline up to this beat
        ctx.lineTo(beatX, height / 2);
        
        // Draw heartbeat pattern
        ctx.lineTo(beatX + 10, height / 2 - 3);
        ctx.lineTo(beatX + 14, height / 2);
        ctx.lineTo(beatX + 18, height / 2 + 3);
        ctx.lineTo(beatX + 20, height / 2 - 20);
        ctx.lineTo(beatX + 24, height / 2 + 5);
        ctx.lineTo(beatX + 28, height / 2);
        ctx.lineTo(beatX + 32, height / 2 - 5);
        ctx.lineTo(beatX + 36, height / 2);
      }
      
      // Draw to the end
      ctx.lineTo(width, height / 2);
    }
    
    // Ensure the line extends to the right edge of the canvas
    ctx.lineTo(width, height / 2);
    
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
                {/* First priority: Valid homeTeam and awayTeam */}
                {eventDetails?.homeTeam && eventDetails?.awayTeam && 
                 eventDetails.homeTeam !== "Home" && eventDetails.homeTeam !== "Unknown" &&
                 eventDetails.awayTeam !== "Away" && eventDetails.awayTeam !== "Unknown"
                  ? `${eventDetails.homeTeam} vs ${eventDetails.awayTeam}`
                  : /* Second priority: Valid event name */
                    (eventDetails?.name && 
                     eventDetails.name !== "Home vs Away" && 
                     eventDetails.name !== "Unknown vs Unknown" &&
                     eventDetails.name !== "Match Details Unavailable")
                      ? eventDetails.name 
                      : /* Third priority: Tournament/country based description */
                        `Match from ${eventDetails?.tournament || eventDetails?.country || "Unknown League"}`}
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
          <div>
            <Skeleton className="h-40 w-full bg-muted/10" />
          </div>
        ) : (
          <div className="relative">
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={200} 
              className="w-full h-[200px] rounded-md"
            />
            
            {/* Status indicator */}
            <div className="absolute top-4 right-4 flex gap-2 items-center">
              {currentStatus === 'available' ? (
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-800">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2"></div>
                  Available
                </Badge>
              ) : currentStatus === 'suspended' ? (
                <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-800">
                  <div className="w-2 h-2 rounded-full bg-red-400 mr-2"></div>
                  Suspended
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-800">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Unknown
                </Badge>
              )}
              
              {currentMinute && (
                <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-800">
                  {currentMinute}'
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-0 text-xs text-muted-foreground">
        <div className="flex w-full justify-between items-center">
          <div>
            Available: {stats.availableDurationMinutes} min | Suspended: {stats.suspendedDurationMinutes} min
          </div>
          <div>
            Last update: {data.length > 0 && data[data.length - 1].time 
              ? new Date(data[data.length - 1].time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
              : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}