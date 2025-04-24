import React from 'react';
import { Link, useLocation } from 'wouter';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, 
  XIcon, 
  LayoutDashboard, 
  Database, 
  Repeat, 
  Clock,
  TrendingUp,
  Dumbbell,
  Trophy,
  Timer,
  Settings
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  isHovering: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, isHovering, onClose }: SidebarProps) {
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
  
  // Get sport icon
  const getSportIcon = (sportCode: string) => {
    const iconMap: Record<string, JSX.Element> = {
      'football': <Trophy className="h-4 w-4 mr-2" />,
      'basketball': <Dumbbell className="h-4 w-4 mr-2" />,
      'tennis': <Timer className="h-4 w-4 mr-2" />,
      'horseracing': <TrendingUp className="h-4 w-4 mr-2" />
    };
    
    return iconMap[sportCode] || <TrendingUp className="h-4 w-4 mr-2" />;
  };
  
  // Get bookmaker color
  const getBookmakerColor = (bookmakerCode: string) => {
    const colorMap: Record<string, string> = {
      'bet365': 'text-blue-600 dark:text-blue-400',
      'williamhill': 'text-green-600 dark:text-green-400',
      'betfair': 'text-orange-600 dark:text-orange-400',
      'paddypower': 'text-red-600 dark:text-red-400',
    };
    
    return colorMap[bookmakerCode] || '';
  };

  return (
    <div
      className={cn(
        "fixed z-20 inset-0 transition duration-200 transform bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 w-64 flex-shrink-0 shadow-lg",
        (isOpen || isHovering) ? "translate-x-0" : "-translate-x-[calc(100%-12px)]"
      )}
    >
      {/* Sidebar header - blue gradient background */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-900 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">OddsCompare</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden rounded-md p-1 text-white hover:bg-blue-700/50"
          >
            <XIcon className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Last update info */}
        <div className="mt-2 text-xs text-blue-100">
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1 opacity-70" />
            <span>Last update: <span className="text-white">{lastUpdate}</span></span>
          </div>
          <div className="flex items-center mt-1">
            <Repeat className="h-3 w-3 mr-1 opacity-70" />
            <span>Next update: <span className="text-white">{nextUpdateStr}</span></span>
          </div>
        </div>
      </div>
      
      {/* Handle to grab sidebar when collapsed */}
      <div className={cn(
        "absolute right-0 top-1/2 transform -translate-y-1/2 h-16 w-3 bg-blue-600 dark:bg-blue-800 rounded-r-md transition-opacity duration-200",
        (isOpen || isHovering) ? "opacity-0" : "opacity-100"
      )}>
        <div className="h-full flex items-center justify-center">
          <div className="w-0.5 h-6 bg-blue-300 dark:bg-blue-500 rounded"></div>
        </div>
      </div>
      
      <div className="p-4 space-y-6">
        <div>
          <p className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Main
          </p>
          <div className="space-y-1">
            <Link href="/">
              <a className={cn(
                "flex items-center px-2 py-2 rounded-md",
                location === "/" 
                  ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              )}>
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </a>
            </Link>
            <Link href="/scraper-status">
              <a className={cn(
                "flex items-center px-2 py-2 rounded-md",
                location === "/scraper-status" 
                  ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              )}>
                <Database className="h-4 w-4 mr-2" />
                Scraper Status
              </a>
            </Link>
            <Link href="/admin">
              <a className={cn(
                "flex items-center px-2 py-2 rounded-md",
                location === "/admin" 
                  ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              )}>
                <Settings className="h-4 w-4 mr-2" />
                Admin Panel
              </a>
            </Link>
          </div>
        </div>
        
        <div>
          <p className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Bookmakers
          </p>
          <div className="space-y-1 bg-gray-50 dark:bg-slate-900/50 rounded-md p-2 border border-gray-100 dark:border-slate-700">
            {bookmakers.map((bookmaker) => (
              <div key={bookmaker.id} className="flex items-center py-1.5">
                <Checkbox
                  id={`bookmaker-${bookmaker.id}`}
                  checked={selectedBookmakers.includes(bookmaker.code)}
                  onCheckedChange={() => toggleBookmaker(bookmaker.code)}
                  className="h-4 w-4 rounded text-blue-500"
                />
                <Label
                  htmlFor={`bookmaker-${bookmaker.id}`}
                  className={cn("ml-2 text-sm font-medium", getBookmakerColor(bookmaker.code))}
                >
                  {bookmaker.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <p className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Sports
          </p>
          <div className="space-y-1 bg-gray-50 dark:bg-slate-900/50 rounded-md p-2 border border-gray-100 dark:border-slate-700">
            {sports.map((sport) => (
              <div key={sport.id} className="flex items-center py-1.5">
                <Checkbox
                  id={`sport-${sport.id}`}
                  checked={selectedSports.includes(sport.code)}
                  onCheckedChange={() => toggleSport(sport.code)}
                  className="h-4 w-4 rounded text-blue-500"
                />
                <Label
                  htmlFor={`sport-${sport.id}`}
                  className="ml-2 text-sm flex items-center text-gray-700 dark:text-gray-300"
                >
                  {getSportIcon(sport.code)}
                  {sport.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
        
        <Separator className="border-gray-200 dark:border-slate-700" />
        
        <div className="bg-gray-50 dark:bg-slate-900/50 rounded-md p-3 border border-gray-100 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <Repeat className="h-4 w-4 mr-2 text-primary" />
              Auto Refresh
            </span>
            <Switch
              checked={autoRefresh}
              onCheckedChange={toggleAutoRefresh}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
            Data refreshes every 15 minutes
          </p>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshData()}
            disabled={isRefreshing}
            className="mt-3 w-full flex items-center justify-center"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1.5", isRefreshing && "animate-spin")} />
            Refresh Now
          </Button>
        </div>
      </div>
    </div>
  );
}
