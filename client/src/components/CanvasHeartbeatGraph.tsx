import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock } from "lucide-react";
import { footballFieldBase64 } from "../lib/football-field-base64";

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

export default function CanvasHeartbeatGraph({ eventId, eventData }: HeartbeatGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading');
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
        setStatus('loading');
        
        // First fetch event details
        const detailsResponse = await fetch(`/api/events/${eventId}`);
        if (detailsResponse.ok) {
          const eventDetailsData = await detailsResponse.json();
          
          // Calculate teams from the event data
          let homeTeam = 'Home';
          let awayTeam = 'Away';
          
          if (eventDetailsData.teams) {
            const teamParts = eventDetailsData.teams.split(' v ');
            if (teamParts.length === 2) {
              homeTeam = teamParts[0].trim();
              awayTeam = teamParts[1].trim();
            }
          }
          
          setEventDetails({
            name: eventDetailsData.teams || 'Unknown Event',
            homeTeam,
            awayTeam,
            country: eventDetailsData.country || null,
            tournament: eventDetailsData.tournament || null,
            // Game minute will be updated from the heartbeat data
          });
        }
        
        // Then fetch heartbeat data
        const response = await fetch(`/api/live-heartbeat/data/${eventId}`);
        if (response.ok) {
          const apiData = await response.json();
          
          if (apiData && apiData.timestamps) {
            // Set the data points
            setData(apiData.timestamps);
            
            // If we got data, check if there's game minute information
            if (apiData.timestamps.length > 0 && apiData.timestamps[apiData.timestamps.length - 1].gameMinute) {
              // Update the event details with the latest game minute
              setEventDetails(prev => {
                if (!prev) return null;
                
                return {
                  ...prev,
                  gameMinute: apiData.timestamps[apiData.timestamps.length - 1].gameMinute
                };
              });
            }
            
            setStatus('idle');
            
            // Draw heartbeat if data exists
            if (apiData.timestamps.length > 0) {
              setTimeout(() => {
                if (canvasRef.current) {
                  drawHeartbeat();
                }
              }, 100);
            }
          }
        } else {
          console.error("Error fetching heartbeat data");
          setStatus('error');
        }
      } catch (error) {
        console.error("Failed to fetch heartbeat data:", error);
        setStatus('error');
      }
    };
    
    // Initial fetch
    fetchData();
    
    // Set up polling every 20 seconds
    intervalId = setInterval(fetchData, 20000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [eventId]);
  
  // Set up canvas and draw heartbeat whenever data changes
  useEffect(() => {
    try {
      if (canvasRef.current) {
        drawHeartbeat();
      }
    } catch (error) {
      console.error("Error drawing heartbeat:", error);
    }
  }, [data]);
  
  // Function to draw the heartbeat graph
  function drawHeartbeat() {
    try {
      console.log("Drawing heartbeat with data points:", data.length);
      
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("Canvas ref is null");
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
      
      // Always draw the grid for visual consistency
      drawGrid(ctx, width, height);
      drawMinuteLabels(ctx, width, height);
      
      // If no data, show empty state message and exit
      if (!data || data.length === 0) {
        console.log("No data available, showing empty state");
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for live data...', width / 2, height / 2);
        return;
      }
      
      // Work with a copy of the data to ensure we don't modify the original
      let timestamps = [...data].sort((a, b) => a.timestamp - b.timestamp);
      
      // Calculate the elapsed time in minutes (default to 45 if insufficient data)
      let elapsedMinutes = 45; // Default
      
      if (timestamps.length >= 2) {
        const firstTimestamp = timestamps[0].timestamp;
        const lastTimestamp = timestamps[timestamps.length - 1].timestamp;
        
        // Calculate the difference in milliseconds and convert to minutes
        const diffMs = lastTimestamp - firstTimestamp;
        elapsedMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        console.log(`Time elapsed between first and last data point: ${elapsedMinutes} minutes`);
      }
      
      // Set a reasonable game minute, capped at 120
      const currentGameMinute = Math.min(elapsedMinutes, 120);
      console.log("Current game minute:", currentGameMinute);
      
      // Draw a simple line based on the availability data
      const pixelsPerMinute = width / 120;
      
      // Set up the drawing style
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Start with a green line (available)
      ctx.strokeStyle = '#00ff00';
      
      // Initial availability state based on first data point (default to available)
      let isAvailable = timestamps.length > 0 ? timestamps[0].isAvailable : true;
      
      // Calculate the number of beats to show
      const beatWidth = 40;  // Doubled width to reduce frequency (was 20)
      const beatCount = Math.ceil(currentGameMinute * pixelsPerMinute / beatWidth);
      const beatsToShow = Math.min(beatCount, Math.ceil(currentGameMinute));
      
      console.log(`Drawing ${beatsToShow} beats for ${currentGameMinute} game minutes`);
      
      // Start the drawing path
      ctx.beginPath();
      ctx.moveTo(0, height / 2);  // Start at the left edge, middle height
      
      for (let i = 0; i < beatsToShow; i++) {
        const x = i * beatWidth;
        
        // Find the market status for this position by searching through timestamps
        let marketAvailable = isAvailable;
        
        // Check data status for every beat to ensure we don't miss suspension changes
        if (timestamps.length > 0) {
          // Get a timestamp index based on our position in the game
          const timestampIndex = Math.min(
            Math.floor((i / beatsToShow) * timestamps.length), 
            timestamps.length - 1
          );
          marketAvailable = timestamps[timestampIndex].isAvailable;
          
          // Log suspended status for debugging
          if (!marketAvailable && i % 10 === 0) {
            console.log(`Detected suspended market at beat ${i}, timestamp index ${timestampIndex}`);
          }
        }
        
        // If market status changed, end current path and start a new one with different color
        if (marketAvailable !== isAvailable) {
          ctx.stroke(); // End current path
          ctx.beginPath(); // Start new path
          ctx.strokeStyle = marketAvailable ? '#00ff00' : '#ff3333'; // Green for available, red for suspended
          ctx.moveTo(x, height / 2); // Continue from same position
          isAvailable = marketAvailable; // Update the status
        }
        
        if (!marketAvailable) {
          // For suspended markets, draw a flat red line with increased width for visibility
          ctx.lineWidth = 4; // Make the line thicker for suspended state
          const endX = Math.min(x + beatWidth, currentGameMinute * pixelsPerMinute);
          ctx.lineTo(endX, height / 2); // Flat line for suspended
        } else {
          ctx.lineWidth = 2; // Normal width for available state
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
    } catch (error) {
      console.error("Error in drawHeartbeat:", error);
      
      // Try to render a fallback if canvas exists
      try {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Clear and show error message
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Error rendering heartbeat', canvas.width / 2, canvas.height / 2);
          }
        }
      } catch (e) {
        console.error("Could not even render fallback:", e);
      }
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
                  <>
                    {eventDetails.homeTeam} vs {eventDetails.awayTeam}
                  </>
                ) : (
                  eventDetails.name
                )}
              </span>
              
              {eventDetails?.gameMinute && (
                <Badge variant="secondary" className="text-xs">
                  {eventDetails.gameMinute}'
                </Badge>
              )}
            </div>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {eventDetails?.country && (
              <Badge variant="outline" className="text-xs">
                {eventDetails.country}
              </Badge>
            )}
            {eventDetails?.tournament && (
              <Badge variant="outline" className="text-xs">
                {eventDetails.tournament}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="mb-4 space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Uptime: {stats.uptimePercentage.toFixed(1)}%</span>
            </div>
            <span>Total tracked: {stats.totalDurationMinutes.toFixed(1)} minutes</span>
          </div>
          <Progress className="h-2" value={stats.uptimePercentage} />
        </div>
        
        <div className="relative">
          <canvas 
            ref={canvasRef}
            className="w-full"
            width={800}
            height={200}
            style={{ background: '#111', borderRadius: '0.5rem' }}
          />
          
          {status === 'loading' && (
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '0.5rem' }}
            >
              <div className="text-white">Loading heartbeat data...</div>
            </div>
          )}
          
          {status === 'error' && (
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.7)', borderRadius: '0.5rem' }}
            >
              <div className="text-white">Failed to load heartbeat data</div>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-green-400">Available: {stats.availableDurationMinutes.toFixed(1)} minutes</span>
            <span className="text-red-400">Suspended: {stats.suspendedDurationMinutes.toFixed(1)} minutes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}