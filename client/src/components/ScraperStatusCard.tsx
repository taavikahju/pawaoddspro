import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScraperStatusCardProps {
  name: string;
  status: string;
  lastRun: string;
  nextRun: string;
  eventCount: number;
  fileSize: string;
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
  const isActive = status === 'Running';
  
  return (
    <Card className={cn("bg-white dark:bg-slate-800 shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-base font-medium text-gray-900 dark:text-white">{name}</h3>
            <p className={cn(
              "mt-1 text-sm flex items-center",
              isActive ? "text-green-500" : "text-red-500"
            )}>
              <CheckCircle className="h-4 w-4 mr-1" />
              <span>{status}</span>
            </p>
          </div>
          <Badge variant={isActive ? "success" : "destructive"} className="text-xs">
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        
        <div className="mt-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-gray-500 dark:text-gray-400">Last Run:</div>
            <div className="text-gray-900 font-medium dark:text-white">{lastRun}</div>
            
            <div className="text-gray-500 dark:text-gray-400">Next Run:</div>
            <div className="text-gray-900 font-medium dark:text-white">{nextRun}</div>
            
            <div className="text-gray-500 dark:text-gray-400">Events Scraped:</div>
            <div className="text-gray-900 font-medium dark:text-white">{eventCount}</div>
            
            <div className="text-gray-500 dark:text-gray-400">File Size:</div>
            <div className="text-gray-900 font-medium dark:text-white">{fileSize}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
