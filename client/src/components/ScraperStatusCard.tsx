import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, Clock, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScraperStatusCardProps {
  name: string;
  status: string;
  lastRun: string;
  nextRun: string;
  eventCount: number;
  fileSize: string | number;
  className?: string;
}

export default function ScraperStatusCard({
  name,
  status,
  lastRun,
  nextRun,
  eventCount,
  fileSize,
  className
}: ScraperStatusCardProps) {
  const isRunning = status === 'Running';
  const isIdle = status === 'Idle';
  const isError = status === 'Error';
  
  const getStatusColor = () => {
    if (isRunning) return 'scraper-status-running';
    if (isIdle) return 'scraper-status-idle';
    return 'scraper-status-error';
  };
  
  const getStatusIcon = () => {
    if (isRunning) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (isIdle) return <Clock className="h-5 w-5 text-yellow-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  };
  
  return (
    <div className={cn("scraper-status-card", className)}>
      {/* Status indicator bar */}
      <div className={cn("scraper-status-indicator", getStatusColor())}></div>
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center">
            <Database className="h-4 w-4 mr-2 text-primary" />
            {name}
          </h3>
          <p className={cn(
            "mt-1 text-sm flex items-center",
            isRunning ? "text-green-500" : 
            isIdle ? "text-yellow-500" : "text-red-500"
          )}>
            {getStatusIcon()}
            <span className="ml-1">{status}</span>
          </p>
        </div>
        <Badge 
          className={cn(
            "text-xs",
            isRunning ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300" : 
            isIdle ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300" : 
            "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
          )}
        >
          {isRunning ? 'Active' : isIdle ? 'Pending' : 'Failed'}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="text-gray-500 dark:text-gray-400">Last Run:</div>
        <div className="text-gray-900 font-medium dark:text-white">{lastRun}</div>
        
        <div className="text-gray-500 dark:text-gray-400">Next Run:</div>
        <div className="text-gray-900 font-medium dark:text-white">{nextRun}</div>
        
        <div className="text-gray-500 dark:text-gray-400">Events:</div>
        <div className="text-gray-900 font-medium dark:text-white">{eventCount}</div>
        
        <div className="text-gray-500 dark:text-gray-400">File Size:</div>
        <div className="text-gray-900 font-medium dark:text-white">{fileSize}</div>
      </div>
    </div>
  );
}
