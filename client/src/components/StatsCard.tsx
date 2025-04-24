import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string | number;
  icon?: React.ReactNode;
  iconColor?: string;
  changeColor?: string;
  className?: string;
}

export default function StatsCard({
  title,
  value,
  change,
  icon,
  iconColor = 'text-green-500',
  changeColor = 'text-green-500',
  className
}: StatsCardProps) {
  return (
    <Card className={cn("bg-white dark:bg-slate-800 shadow-sm", className)}>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <p className="text-2xl font-semibold text-gray-800 dark:text-white">{value}</p>
        
        {change && (
          <div className={cn("mt-1 text-xs flex items-center", changeColor)}>
            {icon || <ChevronUp className="h-4 w-4 mr-1" />}
            <span>{change}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
