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
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    timestamp: Date;
    isAvailable: boolean;
    gameMinute?: string;
  } | null>(null);
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
  
  // Mouse move handler to show timestamp tooltip and draw dynamic horizontal line
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Only process if we have data
      if (data.length === 0) {
        setHoverInfo(null);
        return;
      }
      
      // Check if we're out of bounds
      if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) {
        setHoverInfo(null);
        return;
      }
      
      // Get dimensions
      const width = canvas.width;
      const height = canvas.height;
      
      // Sort timestamps by time (ascending)
      const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
      const firstTimestamp = sortedData[0].timestamp;
      const lastTimestamp = sortedData[sortedData.length - 1].timestamp;
      const timeRange = lastTimestamp - firstTimestamp;
      
      // Convert mouse X position to exact timestamp
      const posRatio = x / width;
      const exactTimestamp = firstTimestamp + (posRatio * timeRange);
      
      // This is the exact timestamp under the mouse cursor
      const hoverTimestamp = new Date(exactTimestamp);
      
      // Find the status at this timestamp by finding the last status change before this point
      let isAvailable = false; // Default
      let gameMinute: string | undefined = undefined;
      
      // Go through all data points to find the last status before our hover point
      for (let i = 0; i < sortedData.length; i++) {
        const point = sortedData[i];
        
        // If this point is past our hover position, stop looking
        if (point.timestamp > exactTimestamp) {
          break;
        }
        
        // Update status and game minute as we pass each data point
        isAvailable = point.isAvailable === true;
        gameMinute = point.gameMinute;
      }
      
      // Create the final point info for display
      let pointInfo = {
        timestamp: hoverTimestamp,
        isAvailable: isAvailable,
        gameMinute: gameMinute
      };
      
      setHoverInfo({
        x, 
        y,
        timestamp: pointInfo.timestamp,
        isAvailable: pointInfo.isAvailable,
        gameMinute: pointInfo.gameMinute
      });
      
      // DRAW DYNAMIC VERTICAL GUIDELINE BASED ON HOVER POSITION
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // First, redraw the entire graph to clear any previous vertical guideline
        drawHeartbeat();
        
        // Only draw the vertical guideline, don't redraw the horizontal line
        // as it would override the actual red/green segments
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isAvailable ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
        ctx.shadowColor = isAvailable ? '#00ff00' : '#ff0000';
        ctx.shadowBlur = 5;
        
        // Draw vertical guideline exactly at the mouse position
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;
      }
      catch (error) {
        console.error("Failed to draw hover guideline:", error);
      }
      
      // Add a visible cursor
      canvas.style.cursor = 'crosshair';
    };
    
    const handleMouseLeave = () => {
      setHoverInfo(null);
      canvas.style.cursor = 'default';
      
      // Redraw the original heartbeat when mouse leaves
      drawHeartbeat();
    };
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [data]);
  
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
            // Debug log to check for suspended events
            const suspendedPoints = apiData.timestamps.filter((p: { isAvailable: boolean | string }) => p.isAvailable === false);
            console.log(`HEARTBEAT DATA: ${apiData.timestamps.length} total data points, ${suspendedPoints.length} suspended points`);
            if (suspendedPoints.length > 0) {
              console.log(`DEBUG - Found suspended data points:`, suspendedPoints.slice(0, 3));
            }
            
            // Ensure suspended status is properly set as boolean
            // The API might return isAvailable as a string or boolean, so we need to handle both cases
            const processedTimestamps = apiData.timestamps.map((point: { 
              timestamp: number; 
              isAvailable: boolean | string; 
              gameMinute?: string;
              marketStatus?: string;
            }) => {
              // Force proper boolean values - EXPLICITLY check for false conditions first
              const isAvailable = !(
                point.isAvailable === false || 
                point.isAvailable === 'false' ||
                point.marketStatus === 'SUSPENDED'
              );
              
              // More verbose logging to debug suspension status
              console.log(`Processing data point: timestamp=${new Date(point.timestamp).toISOString()}, original isAvailable=${point.isAvailable}, marketStatus=${point.marketStatus}, converted=${isAvailable}`);
              
              return {
                ...point,
                isAvailable: isAvailable
              };
            });
            
            // Set the data points directly from the API
            console.log("Using real data points with processed availability status");
            setData(processedTimestamps);
            
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
      
      // Debug log to check suspended events in data
      const suspendedCount = data.filter(point => point.isAvailable === false).length;
      console.log(`DRAWING: Found ${suspendedCount} suspended data points out of ${data.length}`);
      if (suspendedCount > 0) {
        console.log("Sample suspended point:", data.find(point => point.isAvailable === false));
      }
      
      // Work with a copy of the data to ensure we don't modify the original
      let timestamps = [...data].sort((a, b) => a.timestamp - b.timestamp);
      
      // COMPLETELY NEW APPROACH: Draw directly based on the actual timeline data
      // Instead of creating artificial beats, we'll draw the actual data points
      
      // We'll make sure the first timestamp is at x=0 and the last is at x=width
    // This ensures the line spans the entire graph horizontally
    const firstTimestamp = timestamps[0].timestamp;
    const lastTimestamp = timestamps[timestamps.length - 1].timestamp;
    const timeRange = lastTimestamp - firstTimestamp;
    
    // Function to convert a timestamp to x position on canvas
    // This maps the exact timestamp to its precise horizontal position
    const getXPosition = (timestamp: number) => {
      return Math.max(0, Math.min(width, 
        ((timestamp - firstTimestamp) / timeRange) * width
      ));
    };
      
      // Set up paths for available and suspended segments
      let paths: {
        available: boolean;
        points: number[][];
        startTimestamp: number;
        endTimestamp: number;
      }[] = [];
      
      // Initialize with the first data point's status
      let currentPath = {
        available: timestamps[0].isAvailable === true,
        points: [[getXPosition(timestamps[0].timestamp), height / 2]],
        startTimestamp: timestamps[0].timestamp,
        endTimestamp: timestamps[0].timestamp
      };
      
      // Make sure we have the first path in the array
      paths.push(currentPath);
        
      // Process all data points to create path segments
      for (let i = 1; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const isAvailable = timestamp.isAvailable === true;
        const x = getXPosition(timestamp.timestamp);
        
        // If availability status changed, start a new path
        if (isAvailable !== currentPath.available) {
          // Add the timestamp at this position to end the current path
          currentPath.points.push([x, height / 2]);
          currentPath.endTimestamp = timestamp.timestamp;
          
          // Start a new path
          currentPath = {
            available: isAvailable,
            points: [[x, height / 2]],
            startTimestamp: timestamp.timestamp,
            endTimestamp: timestamp.timestamp
          };
          paths.push(currentPath);
          
          console.log(`Status changed at timestamp ${new Date(timestamp.timestamp).toISOString()} - now ${isAvailable ? 'available' : 'suspended'}`);
        }
        
        // If this is the last point, make sure to close the current path
        if (i === timestamps.length - 1) {
          currentPath.endTimestamp = timestamp.timestamp;
          if (!paths.includes(currentPath)) { // Only push if not already in the array
            paths.push(currentPath);
          }
        }
      }
      
      console.log(`Created ${paths.length} path segments based on ${timestamps.length} data points`);
      
      // Now enhance each path with appropriate visualization
      for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        const startX = path.points[0][0];
        const endX = getXPosition(path.endTimestamp);
        const segmentWidth = endX - startX;
        
        if (!path.available) {
          // For suspended segments, just use a flat line
          path.points = [[startX, height / 2], [endX, height / 2]];
        } else {
          // For available segments, we'll draw heartbeats directly on the timestamp positions
          path.points = []; // Reset points for this segment
          
          // Get all timestamps that fall within this path's time range
          const pathTimestamps = timestamps
            .filter(ts => ts.timestamp >= path.startTimestamp && ts.timestamp <= path.endTimestamp)
            .map(ts => ts.timestamp);
            
          // Always start with the segment's start point
          path.points.push([startX, height / 2]);
          
          // Add the heartbeat pattern directly based on the actual timestamps
          for (let j = 0; j < pathTimestamps.length; j++) {
            const timestamp = pathTimestamps[j];
            const x = getXPosition(timestamp);
            
            // Only add heartbeat if there's enough space between points
            const minSpaceBetweenBeats = 20; // Minimum pixels between beats
            const lastPoint = path.points[path.points.length - 1];
            
            if (j > 0 && (x - lastPoint[0]) < minSpaceBetweenBeats) {
              continue; // Skip this point if it's too close to the previous one
            }
            
            // Scale factor for the beat size
            const beatSize = 20; // Height of the main spike
            
            // Add a small beat at each actual timestamp
            path.points.push([x - 4, height / 2]);          // Before beat baseline
            path.points.push([x - 2, height / 2 + 3]);      // Q dip
            path.points.push([x, height / 2 - beatSize]);   // R spike
            path.points.push([x + 2, height / 2 + 5]);      // S dip
            path.points.push([x + 4, height / 2]);          // Return to baseline
            path.points.push([x + 6, height / 2 - 5]);      // T wave
            path.points.push([x + 10, height / 2]);         // End of beat
          }
          
          // Always end with the segment's end point
          const lastPoint = path.points[path.points.length - 1];
          if (lastPoint[0] < endX) {
            path.points.push([endX, height / 2]);
          }
        }
      }
      
      // Now draw all the paths with proper colors
      console.log(`Drawing ${paths.length} separate paths based on market status changes`);
      
      // First draw all available paths (green lines)
      const availablePaths = paths.filter(path => path.available);
      const suspendedPaths = paths.filter(path => !path.available);
      
      console.log(`Segregated paths: ${availablePaths.length} available, ${suspendedPaths.length} suspended`);
      
      // Draw normal green paths first (without effects)
      ctx.shadowBlur = 0;
      availablePaths.forEach((path, index) => {
        ctx.beginPath();
        ctx.strokeStyle = '#00ff00'; // Green
        ctx.lineWidth = 2;
        
        // Draw the path
        path.points.forEach((point, i) => {
          if (i === 0) {
            ctx.moveTo(point[0], point[1]);
          } else {
            ctx.lineTo(point[0], point[1]);
          }
        });
        
        ctx.stroke();
      });
      
      // Then draw suspended paths on top with glow effect
      suspendedPaths.forEach((path, index) => {
        ctx.beginPath();
        ctx.strokeStyle = '#ff0000'; // Red
        ctx.lineWidth = 6; // Much thicker for suspended
        
        // Add strong glowing effect for suspended paths
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        
        // Draw the path
        path.points.forEach((point, i) => {
          if (i === 0) {
            ctx.moveTo(point[0], point[1]);
          } else {
            ctx.lineTo(point[0], point[1]);
          }
        });
        
        ctx.stroke();
        console.log(`Drew SUSPENDED path ${index+1}/${suspendedPaths.length} with ${path.points.length} points`);
      });
      
      // Reset shadow effects
      ctx.shadowBlur = 0;
      
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
  
  // Function to draw time labels based on actual timestamps
  function drawMinuteLabels(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Only draw if we have data
    if (!data || data.length === 0) return;
    
    // Sort timestamps
    const timestamps = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const firstTimestamp = timestamps[0].timestamp;
    const lastTimestamp = timestamps[timestamps.length - 1].timestamp;
    const timeRange = lastTimestamp - firstTimestamp;
    
    // Function to convert a timestamp to x position on canvas
    const getXPosition = (timestamp: number) => {
      return Math.max(0, Math.min(width, 
        ((timestamp - firstTimestamp) / timeRange) * width
      ));
    };
    
    // Calculate appropriate time increments based on the total time range
    // If total range is > 60 minutes, use 10-minute increments
    // If total range is > 180 minutes, use 30-minute increments
    const totalMinutesRange = timeRange / (1000 * 60);
    let minuteIncrement = 5; // Default to 5 minutes
    
    if (totalMinutesRange > 180) {
      minuteIncrement = 30;
    } else if (totalMinutesRange > 60) {
      minuteIncrement = 10;
    }
    
    console.log(`Total time range: ${totalMinutesRange.toFixed(1)} minutes, using ${minuteIncrement}-minute increments`);
    
    // Create time increments based on the actual time range
    const startTime = new Date(firstTimestamp);
    startTime.setMinutes(Math.floor(startTime.getMinutes() / minuteIncrement) * minuteIncrement); // Round down to nearest interval
    startTime.setSeconds(0);
    startTime.setMilliseconds(0);
    
    const endTime = new Date(lastTimestamp);
    
    ctx.font = '10px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    
    // Generate labels at calculated intervals
    const currentTime = new Date(startTime);
    while (currentTime <= endTime) {
      const timestamp = currentTime.getTime();
      const x = getXPosition(timestamp);
      
      // Format the time as HH:MM
      const timeStr = currentTime.toTimeString().substring(0, 5);
      ctx.fillText(timeStr, x, height - 5);
      
      // Draw a vertical line for the time marker
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.moveTo(x, height - 15);
      ctx.lineTo(x, 0);
      ctx.stroke();
      
      // Increment by the calculated increment
      currentTime.setMinutes(currentTime.getMinutes() + minuteIncrement);
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
        
        // Sort data points by timestamp
        const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
        
        // Calculate actual time span in minutes if we have data points
        let totalMinutes = 0;
        let availableMinutes = 0;
        let suspendedMinutes = 0;
        
        if (sortedData.length >= 2) {
          const firstTimestamp = sortedData[0].timestamp;
          const lastTimestamp = sortedData[sortedData.length - 1].timestamp;
          
          // Get total time in minutes
          totalMinutes = (lastTimestamp - firstTimestamp) / (1000 * 60);
          
          // Calculate available/suspended based on the percentage of data points
          const ratio = availableCount / (availableCount + suspendedCount);
          availableMinutes = totalMinutes * ratio;
          suspendedMinutes = totalMinutes - availableMinutes;
        }
        
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
                  "Loading match details..."
                ) : eventDetails.homeTeam && eventDetails.awayTeam && 
                   eventDetails.homeTeam !== "Home" && eventDetails.homeTeam !== "Unknown" &&
                   eventDetails.awayTeam !== "Away" && eventDetails.awayTeam !== "Unknown" ? (
                  <>
                    {eventDetails.homeTeam} vs {eventDetails.awayTeam}
                  </>
                ) : eventDetails.name && eventDetails.name !== "Unknown" ? (
                  eventDetails.name
                ) : (
                  `Match from ${eventDetails?.tournament || eventDetails?.country || "Unknown League"}`
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
          
          {/* Timestamp tooltip */}
          {hoverInfo && (
            <div 
              className={`absolute px-3 py-2 text-xs rounded pointer-events-none ${hoverInfo.isAvailable ? 'bg-green-700/90' : 'bg-red-700/90'} text-white border-2 border-white/40 shadow-lg`}
              style={{ 
                left: `${hoverInfo.x}px`, 
                top: `${Math.max(10, hoverInfo.y - 45)}px`,
                transform: 'translateX(-50%)',
                zIndex: 20,
                whiteSpace: 'nowrap'
              }}
            >
              <div className="font-bold text-sm">
                {hoverInfo.timestamp.toLocaleTimeString()} 
                {hoverInfo.gameMinute && <span className="ml-2">(Min {hoverInfo.gameMinute})</span>}
              </div>
              <div className="mt-1">
                Status: <span className="font-semibold">{hoverInfo.isAvailable ? 'Available' : 'Suspended'}</span>
              </div>
            </div>
          )}
          
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