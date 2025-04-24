import React from 'react';
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
    <div className={cn("stats-card relative overflow-hidden group", className)}>
      {/* Corner gradient */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/5 to-primary/20 rounded-bl-full transform -translate-x-2 translate-y-[-50%] opacity-60 dark:from-primary/10 dark:to-primary/30"></div>
      
      {/* Icon background */}
      <div className="absolute top-3 right-3 p-2 rounded-full bg-primary/10 dark:bg-primary/20 transition-transform duration-200 transform group-hover:scale-110">
        {icon || <ChevronUp className={cn("h-5 w-5", iconColor)} />}
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <p className="text-2xl font-bold text-gray-800 dark:text-white">
          {value}
        </p>
        
        {change && (
          <div className={cn("text-xs flex items-center", changeColor)}>
            <span>{change}</span>
          </div>
        )}
      </div>
    </div>
  );
}
