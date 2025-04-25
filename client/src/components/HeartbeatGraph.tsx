import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { HeartPulse, Clock } from 'lucide-react';

interface DataPoint {
  timestamp: number;
  isAvailable: boolean;
}

interface HeartbeatGraphProps {
  eventId: string;
  historical?: boolean;
}

const HeartbeatGraph: React.FC<HeartbeatGraphProps> = ({ eventId, historical = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lastBeep, setLastBeep] = useState<number>(0);
  
  // Fetch heartbeat data for this specific event
  const { 
    data: heartbeatData = [], 
    isLoading 
  } = useQuery<DataPoint[]>({
    queryKey: [historical ? '/api/live-heartbeat/history' : '/api/live-heartbeat/data', eventId],
    refetchInterval: historical ? false : 2000, // Only refresh live data, not historical
  });
  
  // Draw the heartbeat on canvas
  useEffect(() => {
    if (!canvasRef.current || !heartbeatData.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Ensure canvas is sized correctly
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        drawHeartbeat();
      }
    });
    
    resizeObserver.observe(canvas.parentElement || canvas);
    
    // Draw the heartbeat visualization
    function drawHeartbeat() {
      if (!ctx || !canvas) return;
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Calculate scale for data points to fit canvas
      const dataPoints = Math.min(heartbeatData.length, 100); // Limit to last 100 points for performance
      const slicedData = heartbeatData.slice(-dataPoints);
      
      // If no data, show a flat line
      if (slicedData.length === 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#d1d5db'; // gray-300
        ctx.lineWidth = 2;
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }
      
      // Draw background grid
      drawGrid(ctx, width, height);
      
      // Draw the heartbeat line
      ctx.beginPath();
      ctx.strokeStyle = '#10b981'; // green-500
      ctx.lineWidth = 3;
      
      const xStep = width / (dataPoints - 1 || 1);
      let lastY = height / 2;
      
      slicedData.forEach((point, index) => {
        const x = index * xStep;
        let y;
        
        if (point.isAvailable) {
          // Draw pulse when market is available
          if (index > 0 && slicedData[index - 1].isAvailable) {
            // Continue normal heartbeat pattern
            const pulseHeight = height * 0.4;
            const baseY = height * 0.5;
            
            // Create more natural heartbeat pattern
            if (index % 5 === 0) {
              y = baseY - pulseHeight * 0.8; // Big peak
            } else if (index % 5 === 1) {
              y = baseY + pulseHeight * 0.4; // Dip after peak
            } else {
              y = baseY - pulseHeight * 0.1; // Normal rhythm
            }
          } else {
            // Start of available section - spike up
            y = height * 0.1; // High peak to indicate market just opened
            
            // Play beep sound for newly available markets in live mode
            if (!historical && index === slicedData.length - 1 && Date.now() - lastBeep > 1000) {
              playBeep();
              setLastBeep(Date.now());
            }
          }
        } else {
          // Flatline when market suspended
          y = height * 0.8; // Lower position to indicate suspended
        }
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          // Create a smoother transition between points
          ctx.bezierCurveTo(
            x - xStep / 2, lastY, 
            x - xStep / 2, y, 
            x, y
          );
        }
        
        lastY = y;
      });
      
      ctx.stroke();
      
      // Add time labels
      drawTimeLabels(ctx, width, height, slicedData);
      
      // Add current status indicator
      if (slicedData.length > 0) {
        const lastPoint = slicedData[slicedData.length - 1];
        drawStatusIndicator(ctx, width, height, lastPoint.isAvailable);
      }
    }
    
    // Draw background grid
    function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
      ctx.strokeStyle = '#e5e7eb'; // gray-200
      ctx.lineWidth = 1;
      
      // Horizontal grid lines
      for (let i = 0; i < height; i += height / 10) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }
      
      // Vertical grid lines
      for (let i = 0; i < width; i += width / 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
    }
    
    // Draw time labels on x-axis
    function drawTimeLabels(ctx: CanvasRenderingContext2D, width: number, height: number, data: DataPoint[]) {
      if (data.length < 2) return;
      
      ctx.fillStyle = '#6b7280'; // gray-500
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      
      // Draw time markers at regular intervals
      const labelCount = 5; // Number of time labels to show
      const step = Math.floor(data.length / labelCount);
      
      for (let i = 0; i < data.length; i += step) {
        if (i >= data.length) continue;
        
        const x = (i / (data.length - 1)) * width;
        const time = new Date(data[i].timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        
        ctx.fillText(time, x, height - 5);
      }
    }
    
    // Draw status indicator
    function drawStatusIndicator(ctx: CanvasRenderingContext2D, width: number, height: number, isAvailable: boolean) {
      ctx.fillStyle = isAvailable ? '#10b981' : '#ef4444'; // green-500 or red-500
      
      // Draw indicator in top-right corner
      const radius = 8;
      const x = width - radius - 10;
      const y = radius + 10;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Add label
      ctx.fillStyle = '#1f2937'; // gray-800
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(isAvailable ? 'AVAILABLE' : 'SUSPENDED', x - radius - 5, y + 4);
    }
    
    // Play heartbeat beep sound
    function playBeep() {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.1;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(0);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
        setTimeout(() => oscillator.stop(), 300);
      } catch (e) {
        console.error('Error playing beep:', e);
      }
    }
    
    // Initial draw
    drawHeartbeat();
    
    // Clean up
    return () => {
      resizeObserver.disconnect();
    };
  }, [heartbeatData, historical, lastBeep]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <HeartPulse className="h-10 w-10 text-primary animate-pulse" />
      </div>
    );
  }
  
  return (
    <div className="relative h-full">
      {/* Time indicator */}
      <div className="absolute top-2 right-2 text-xs text-muted-foreground flex items-center">
        <Clock className="h-3 w-3 mr-1" />
        Last update: {heartbeatData.length > 0 
          ? new Date(heartbeatData[heartbeatData.length - 1].timestamp).toLocaleTimeString()
          : 'No data'
        }
      </div>
      
      {/* Empty state */}
      {heartbeatData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <HeartPulse className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p>No heartbeat data available</p>
            <p className="text-xs mt-1">Market tracking will begin when available</p>
          </div>
        </div>
      )}
      
      {/* Canvas for drawing the heartbeat */}
      <div className="w-full h-full">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full" 
          style={{ display: heartbeatData.length === 0 ? 'none' : 'block' }}
        />
      </div>
    </div>
  );
};

export default HeartbeatGraph;