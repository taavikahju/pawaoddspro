import React from 'react';
import { Link, useLocation } from 'wouter';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { useThemeToggle } from '@/hooks/use-theme';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import CountryFlag from '@/components/CountryFlag';
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
  Settings,
  SunIcon,
  MoonIcon,
  Filter,
  Activity
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
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'ghana' | 'kenya' | null>(null);
  const { toggleTheme, isDarkMode } = useThemeToggle();
  const { 
    bookmakers, 
    sports, 
    selectedBookmakers,
    selectedSports,
    autoRefresh,
    minMarginFilter,
    maxMarginFilter,
    toggleBookmaker,
    toggleSport,
    toggleAutoRefresh,
    setMinMarginFilter,
    setMaxMarginFilter,
    resetMarginFilters,
    refreshData,
    isRefreshing
  } = useBookmakerContext();

  // Fetch stats
  const { data: stats = { lastScrapeTime: 'N/A', timeToNextUpdate: 15 } } = useQuery<{ 
    lastScrapeTime: string; 
    timeToNextUpdate: number;
  }>({
    queryKey: ['/api/stats'],
    refetchInterval: autoRefresh ? 60000 : false, // Refresh every minute if autoRefresh is enabled
  });
  
  // Function to detect if a specific filter is active based on selected bookmakers
  React.useEffect(() => {
    const ghanaBookmakers = bookmakers
      .filter(b => b.code === 'bp GH' || b.code === 'sporty')
      .map(b => b.code);
      
    const kenyaBookmakers = bookmakers
      .filter(b => b.code === 'bp KE' || b.code === 'betika KE')
      .map(b => b.code);
    
    console.log('Effect - Selected bookmakers:', selectedBookmakers);
    console.log('Effect - Ghana bookmakers:', ghanaBookmakers);
    console.log('Effect - Kenya bookmakers:', kenyaBookmakers);
    
    // Check if Ghana filter is active
    const isGhanaActive = ghanaBookmakers.every(code => selectedBookmakers.includes(code)) && 
      selectedBookmakers.length === ghanaBookmakers.length;
      
    // Check if Kenya filter is active  
    const isKenyaActive = kenyaBookmakers.every(code => selectedBookmakers.includes(code)) && 
      selectedBookmakers.length === kenyaBookmakers.length;
      
    // Check if all bookmakers are selected
    const isAllActive = bookmakers.every(b => selectedBookmakers.includes(b.code));
    
    console.log('Ghana active:', isGhanaActive, 'Kenya active:', isKenyaActive, 'All active:', isAllActive);
    
    if (isGhanaActive) {
      setActiveFilter('ghana');
    } else if (isKenyaActive) {
      setActiveFilter('kenya');
    } else if (isAllActive) {
      setActiveFilter('all');
    } else {
      setActiveFilter(null);
    }
  }, [selectedBookmakers, bookmakers]);

  // Format the last update time as HH:MM UTC
  const formatTimeUTC = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC'
    }) + ' UTC';
  };

  // Last update time handling 
  // stats.lastScrapeTime is already in the format "HH:MM UTC", so we don't need to format it
  const lastUpdate = stats.lastScrapeTime || 'N/A';
  
  // Next update time calculation and formatting
  const timeToNextUpdate = stats.timeToNextUpdate;
  const nextUpdate = new Date();
  nextUpdate.setMinutes(nextUpdate.getMinutes() + timeToNextUpdate);
  const nextUpdateStr = formatTimeUTC(nextUpdate);
  
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
        (isOpen || isHovering) ? "translate-x-0" : "-translate-x-[calc(100%-10px)]"
      )}
    >
      {/* Sidebar header */}
      <div className="p-2.5 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-gray-800 dark:text-white">pawa<span className="text-[#00BCFF] text-base font-bold">odds</span>.pro</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="lg:hidden rounded-md p-0.5 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Handle to grab sidebar when collapsed */}
      <div className={cn(
        "absolute right-0 top-1/2 transform -translate-y-1/2 h-16 w-3 bg-gray-200 dark:bg-slate-700 rounded-r-md transition-opacity duration-200",
        (isOpen || isHovering) ? "opacity-0" : "opacity-100"
      )}>
        <div className="h-full flex items-center justify-center">
          <div className="w-0.5 h-6 bg-gray-400 dark:bg-slate-500 rounded"></div>
        </div>
      </div>
      
      <div className="p-3 space-y-4">
        <div>
          <p className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Main
          </p>
          <div className="space-y-1">
            <Link href="/">
              <a className={cn(
                "flex items-center px-2 py-1 rounded-md text-sm",
                location === "/" 
                  ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              )}>
                <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                Dashboard
              </a>
            </Link>
            <Link href="/scraper-status">
              <a className={cn(
                "flex items-center px-2 py-1 rounded-md text-sm",
                location === "/scraper-status" 
                  ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              )}>
                <Database className="h-3.5 w-3.5 mr-1.5" />
                Scraper Status
              </a>
            </Link>
            <Link href="/live-heartbeat">
              <a className={cn(
                "flex items-center px-2 py-1 rounded-md text-sm",
                location === "/live-heartbeat" 
                  ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              )}>
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Live Heartbeat
              </a>
            </Link>
            <Link href="/admin">
              <a className={cn(
                "flex items-center px-2 py-1 rounded-md text-sm",
                location === "/admin" 
                  ? "bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400 font-medium" 
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              )}>
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Admin Panel
              </a>
            </Link>
          </div>
        </div>
        
        <div>
          <p className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Quick Filters
          </p>
          <div className="flex flex-col space-y-1 mb-2">
            <Button 
              variant={activeFilter === 'ghana' ? 'default' : 'outline'} 
              size="sm" 
              className={cn(
                "py-1 px-2 h-auto text-xs font-medium justify-start",
                activeFilter === 'ghana' 
                  ? "bg-primary text-white hover:bg-primary/90" 
                  : "bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700"
              )}
              onClick={() => {
                // Find bookmaker IDs for Ghana
                const ghanaBookmakers = bookmakers
                  .filter(b => b.code === 'bp GH' || b.code === 'sporty')
                  .map(b => b.code);
                
                // Deselect all bookmakers
                bookmakers.forEach(b => {
                  if (selectedBookmakers.includes(b.code) && !ghanaBookmakers.includes(b.code)) {
                    toggleBookmaker(b.code);
                  } else if (!selectedBookmakers.includes(b.code) && ghanaBookmakers.includes(b.code)) {
                    toggleBookmaker(b.code);
                  }
                });
                
                // Set active filter
                setActiveFilter('ghana');
              }}
            >
              <CountryFlag countryCode="GH" countryName="Ghana" size="sm" className="mr-1.5" />
              Ghana
            </Button>
            
            <Button 
              variant={activeFilter === 'kenya' ? 'default' : 'outline'} 
              size="sm" 
              className={cn(
                "py-1 px-2 h-auto text-xs font-medium justify-start",
                activeFilter === 'kenya' 
                  ? "bg-primary text-white hover:bg-primary/90" 
                  : "bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700"
              )}
              onClick={() => {
                // Find bookmaker IDs for Kenya
                const kenyaBookmakers = bookmakers
                  .filter(b => b.code === 'bp KE' || b.code === 'betika KE')
                  .map(b => b.code);
                
                // Deselect all bookmakers
                bookmakers.forEach(b => {
                  if (selectedBookmakers.includes(b.code) && !kenyaBookmakers.includes(b.code)) {
                    toggleBookmaker(b.code);
                  } else if (!selectedBookmakers.includes(b.code) && kenyaBookmakers.includes(b.code)) {
                    toggleBookmaker(b.code);
                  }
                });
                
                // Set active filter
                setActiveFilter('kenya');
              }}
            >
              <CountryFlag countryCode="KE" countryName="Kenya" size="sm" className="mr-1.5" />
              Kenya
            </Button>
            
            <Button 
              variant={activeFilter === 'all' ? 'default' : 'outline'} 
              size="sm" 
              className={cn(
                "py-1 px-2 h-auto text-xs font-medium justify-start",
                activeFilter === 'all' 
                  ? "bg-primary text-white hover:bg-primary/90" 
                  : "bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700"
              )}
              onClick={() => {
                // Select all bookmakers that aren't already selected
                bookmakers.forEach(b => {
                  if (!selectedBookmakers.includes(b.code)) {
                    toggleBookmaker(b.code);
                  }
                });
                
                // Set active filter
                setActiveFilter('all');
              }}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              All Bookmakers
            </Button>
          </div>
          
          <p className="px-2 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Bookmakers
          </p>
          <div className="space-y-1 bg-gray-50 dark:bg-slate-900/50 rounded-md p-2 border border-gray-100 dark:border-slate-700">
            {bookmakers.map((bookmaker) => (
              <div key={bookmaker.id} className="flex items-center py-1">
                <Checkbox
                  id={`bookmaker-${bookmaker.id}`}
                  checked={selectedBookmakers.includes(bookmaker.code)}
                  onCheckedChange={() => {
                    toggleBookmaker(bookmaker.code);
                    // Active filter will be automatically updated via the useEffect
                  }}
                  className="h-3.5 w-3.5 rounded text-blue-500"
                />
                <Label
                  htmlFor={`bookmaker-${bookmaker.id}`}
                  className={cn("ml-1.5 text-xs font-medium", getBookmakerColor(bookmaker.code))}
                >
                  {bookmaker.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
        

        
        {/* Margin Filter Section */}
        <div>
          <p className="px-2 mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Margin Filter
          </p>
          <div className="space-y-2 bg-gray-50 dark:bg-slate-900/50 rounded-md p-2 border border-gray-100 dark:border-slate-700">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Margin: {minMarginFilter}% - {maxMarginFilter}%
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetMarginFilters}
                  className="h-5 text-[10px] px-1 py-0"
                >
                  Reset
                </Button>
              </div>
              
              <Slider
                value={[minMarginFilter, maxMarginFilter]}
                min={0}
                max={15}
                step={1}
                onValueChange={(values) => {
                  setMinMarginFilter(values[0]);
                  setMaxMarginFilter(values[1]);
                }}
                className="mb-1"
              />
              
              <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400">
                <span>0%</span>
                <span>5%</span>
                <span>10%</span>
                <span>15%</span>
              </div>
            </div>
          </div>
        </div>
        
        <Separator className="border-gray-200 dark:border-slate-700 my-1" />
        
        <div className="bg-gray-50 dark:bg-slate-900/50 rounded-md p-2 border border-gray-100 dark:border-slate-700">
          {/* Theme toggle */}
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center">
              {isDarkMode ? <MoonIcon className="h-3.5 w-3.5 mr-1" /> : <SunIcon className="h-3.5 w-3.5 mr-1" />}
              {isDarkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
            <Switch
              checked={isDarkMode}
              onCheckedChange={toggleTheme}
              className="scale-75 origin-right"
            />
          </div>
          
          {/* Last update info - moved to bottom of sidebar */}
          <div className="mt-3 text-[10px] text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center">
              <Clock className="h-2.5 w-2.5 mr-1" />
              <span>Last update: <span className="text-gray-700 dark:text-gray-300">{lastUpdate}</span></span>
            </div>
            <div className="flex items-center mt-0.5">
              <Repeat className="h-2.5 w-2.5 mr-1" />
              <span>Next update: <span className="text-gray-700 dark:text-gray-300">{nextUpdateStr}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
