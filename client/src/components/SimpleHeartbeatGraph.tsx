import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock } from "lucide-react";

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

export default function SimpleHeartbeatGraph({ eventId, eventData }: HeartbeatGraphProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading');
  const [stats, setStats] = useState<HeartbeatStats>({
    uptimePercentage: 0,
    availableDurationMinutes: 0,
    suspendedDurationMinutes: 0,
    totalDurationMinutes: 0
  });
  
  // State to store event details
  const [eventDetails, setEventDetails] = useState<{
    name: string;
    homeTeam?: string;
    awayTeam?: string;
    gameMinute?: string;
    country?: string;
    tournament?: string;
  } | null>(null);
  
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

  // Fetch data and event details
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
  
  // Creates a visual display of heartbeat data that resembles an ECG monitor
  const renderHeartbeatDisplay = () => {
    if (data.length === 0) {
      return (
        <div className="text-center py-10 text-gray-400">
          No heartbeat data available
        </div>
      );
    }
    
    // Sort data points by timestamp
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    
    // Background image for football field effect (faded green)
    const footballFieldBackground = `
      radial-gradient(circle at center, rgba(0, 255, 0, 0.05) 0%, rgba(0, 0, 0, 0) 70%),
      linear-gradient(to right, rgba(0, 50, 0, 0.2) 0%, rgba(0, 20, 0, 0.1) 50%, rgba(0, 50, 0, 0.2) 100%)
    `;
    
    return (
      <div 
        className="relative w-full h-[200px] bg-black rounded-md overflow-hidden" 
        style={{ background: footballFieldBackground }}
      >
        {/* Grid lines */}
        <div className="absolute inset-0">
          {/* Horizontal grid lines */}
          {Array.from({ length: 7 }).map((_, i) => (
            <div 
              key={`h-${i}`}
              className="absolute w-full h-px bg-green-500/10" 
              style={{ top: `${(i/6) * 100}%` }}
            />
          ))}
          
          {/* Vertical grid lines */}
          {Array.from({ length: 13 }).map((_, i) => (
            <div 
              key={`v-${i}`}
              className="absolute h-full w-px bg-green-500/10" 
              style={{ left: `${(i/12) * 100}%` }}
            />
          ))}
          
          {/* Major grid lines */}
          <div className="absolute w-full h-px bg-green-500/30" style={{ top: '50%' }} />
          
          {/* Time markers */}
          {[0, 15, 30, 45, 60, 75, 90, 105, 120].map(minute => (
            <div 
              key={`t-${minute}`} 
              className="absolute bottom-1 text-[10px] text-white/70 text-center"
              style={{ 
                left: `${(minute/120) * 100}%`, 
                width: "20px", 
                marginLeft: "-10px" 
              }}
            >
              {minute}'
            </div>
          ))}
        </div>
        
        {/* SVG-based ECG heartbeat visualization */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {/* Create a custom ECG pattern that looks more realistic */}
          <defs>
            <pattern id="availablePattern" patternUnits="userSpaceOnUse" width="60" height="200" patternTransform="scale(1 1)">
              <path 
                d="M0,100 L5,100 L10,95 L15,105 L20,100 L25,100 L30,80 L35,120 L40,100 L45,100 L55,100 L60,100" 
                fill="none" 
                stroke="#00ff00" 
                strokeWidth="2"
              />
            </pattern>
          </defs>
          
          {/* Draw a green line when market is available */}
          <g>
            {sortedData.map((point, index) => {
              if (index === 0) return null; // Skip first point
              
              const prevPoint = sortedData[index-1];
              const startTime = sortedData[0].timestamp;
              const totalDuration = sortedData[sortedData.length-1].timestamp - startTime;
              
              // Calculate position percentage
              const startPercent = ((prevPoint.timestamp - startTime) / totalDuration) * 100;
              const endPercent = ((point.timestamp - startTime) / totalDuration) * 100;
              
              // Skip if segment is too small
              if (endPercent - startPercent < 0.5) return null;
              
              // Create heart monitor appearance
              if (point.isAvailable) {
                // Draw the available heartbeat pattern
                return (
                  <g key={index}>
                    {/* Base line */}
                    <line 
                      x1={`${startPercent}%`} 
                      y1="50%" 
                      x2={`${endPercent}%`} 
                      y2="50%" 
                      stroke="#00ff00" 
                      strokeWidth="2"
                    />
                    
                    {/* ECG peaks (every few segments) */}
                    {(index % 3 === 0) && (
                      <path 
                        d={`
                          M ${startPercent + (endPercent-startPercent)/2 - 10}%,50% 
                          L ${startPercent + (endPercent-startPercent)/2 - 5}%,45% 
                          L ${startPercent + (endPercent-startPercent)/2}%,35% 
                          L ${startPercent + (endPercent-startPercent)/2 + 3}%,55% 
                          L ${startPercent + (endPercent-startPercent)/2 + 6}%,50%
                        `}
                        fill="none"
                        stroke="#00ff00"
                        strokeWidth="2"
                      />
                    )}
                  </g>
                );
              } else {
                // Draw a flat red line for suspended status
                return (
                  <line 
                    key={index}
                    x1={`${startPercent}%`} 
                    y1="50%" 
                    x2={`${endPercent}%`} 
                    y2="50%" 
                    stroke="#ff3333" 
                    strokeWidth="2"
                  />
                );
              }
            })}
          </g>
        </svg>
      </div>
    );
  };
  
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
          {status === 'loading' ? (
            <div className="bg-black/80 rounded-md p-8 flex items-center justify-center h-[200px]">
              <div className="text-white">Loading heartbeat data...</div>
            </div>
          ) : status === 'error' ? (
            <div className="bg-black/80 rounded-md p-8 flex items-center justify-center h-[200px]">
              <div className="text-white">Failed to load heartbeat data</div>
            </div>
          ) : (
            renderHeartbeatDisplay()
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