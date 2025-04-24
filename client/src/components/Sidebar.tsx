import React from 'react';
import { Link, useLocation } from 'wouter';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, XIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { 
    bookmakers, 
    sports, 
    selectedBookmakers,
    selectedSports,
    autoRefresh,
    toggleBookmaker,
    toggleSport,
    toggleAutoRefresh,
    refreshData,
    isRefreshing
  } = useBookmakerContext();

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['/api/stats'],
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute if autoRefresh is enabled
  });

  const lastUpdate = stats?.lastScrapeTime || 'N/A';
  const timeToNextUpdate = stats?.timeToNextUpdate || 15;
  const nextUpdate = new Date();
  nextUpdate.setMinutes(nextUpdate.getMinutes() + timeToNextUpdate);
  const nextUpdateStr = nextUpdate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div
      className={cn(
        "fixed z-20 inset-0 lg:relative lg:translate-x-0 transition duration-200 transform bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 w-64 flex-shrink-0 p-4 lg:block",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-primary dark:text-blue-400">OddsCompare</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="lg:hidden rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700"
        >
          <XIcon className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="space-y-6">
        <div>
          <p className="px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Main
          </p>
          <div className="mt-2 space-y-1">
            <Link href="/">
              <a className={cn(
                "block px-2 py-2 rounded-md",
                location === "/" 
                  ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              )}>
                Dashboard
              </a>
            </Link>
            <Link href="/scraper-status">
              <a className={cn(
                "block px-2 py-2 rounded-md",
                location === "/scraper-status" 
                  ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              )}>
                Scraper Status
              </a>
            </Link>
          </div>
        </div>
        
        <div>
          <p className="px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Bookmakers
          </p>
          <div className="mt-2 space-y-1">
            {bookmakers.map((bookmaker) => (
              <div key={bookmaker.id} className="flex items-center px-2 py-2">
                <Checkbox
                  id={`bookmaker-${bookmaker.id}`}
                  checked={selectedBookmakers.includes(bookmaker.code)}
                  onCheckedChange={() => toggleBookmaker(bookmaker.code)}
                  className="h-4 w-4 rounded text-blue-500"
                />
                <Label
                  htmlFor={`bookmaker-${bookmaker.id}`}
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  {bookmaker.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <p className="px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Sports
          </p>
          <div className="mt-2 space-y-1">
            {sports.map((sport) => (
              <div key={sport.id} className="flex items-center px-2 py-2">
                <Checkbox
                  id={`sport-${sport.id}`}
                  checked={selectedSports.includes(sport.code)}
                  onCheckedChange={() => toggleSport(sport.code)}
                  className="h-4 w-4 rounded text-blue-500"
                />
                <Label
                  htmlFor={`sport-${sport.id}`}
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  {sport.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
        
        <Separator className="border-gray-200 dark:border-slate-700" />
        
        <div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Refresh</span>
            <Switch
              checked={autoRefresh}
              onCheckedChange={toggleAutoRefresh}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Data refreshes every 15 minutes
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
            <span>Last update: <span>{lastUpdate}</span></span>
            <span>Next update: <span>{nextUpdateStr}</span></span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refreshData()}
            disabled={isRefreshing}
            className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
          >
            <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>
    </div>
  );
}
