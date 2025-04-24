import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import StatsCard from '@/components/StatsCard';
import OddsTable from '@/components/OddsTable';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LayoutGrid, 
  List, 
  ChevronUp, 
  Clock, 
  CheckCircle, 
  BarChart,
  BookOpen,
  CalendarDays,
  Trophy,
  ShieldAlert,
  X,
  Filter,
  GlobeIcon
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [marketFilter, setMarketFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [tournamentFilter, setTournamentFilter] = useState('all');
  const { selectedSports } = useBookmakerContext();
  
  // Fetch stats data
  const { 
    data: stats,
    isLoading: isLoadingStats 
  } = useQuery({ 
    queryKey: ['/api/stats'],
    refetchInterval: 60000, // Refresh every minute
  });
  
  // Fetch events (filtered by selected sports)
  const { 
    data: events = [],
    isLoading: isLoadingEvents 
  } = useQuery({ 
    queryKey: ['/api/events'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Filter events by selected sports
  const filteredEvents = events.filter((event: any) => {
    const sport = event.sportId;
    return selectedSports.some((selectedSport) => {
      // Map sport codes to IDs 
      // (in a real app, we'd have a more robust mapping)
      const sportMap: Record<string, number> = {
        'football': 1,
        'basketball': 2,
        'tennis': 3,
        'horseracing': 4
      };
      
      return sportMap[selectedSport] === sport;
    });
  });
  
  // Get sport name by ID
  const getSportName = (sportId: number): string => {
    const sportMap: Record<number, string> = {
      1: 'Football',
      2: 'Basketball',
      3: 'Tennis',
      4: 'Horse Racing'
    };
    
    return sportMap[sportId] || 'Unknown';
  };
  
  // Get the sport name based on the first event in filtered list
  const sportTitle = filteredEvents.length > 0 
    ? getSportName(filteredEvents[0].sportId) 
    : 'All Sports';
  
  return (
    <Layout 
      title="Bookmaker Odds Comparison"
      subtitle="Compare odds across multiple bookmakers"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Events"
          value={stats?.totalEvents || 0}
          change={`${stats?.eventsChange > 0 ? '+' : ''}${stats?.eventsChange || 0} since last update`}
          icon={<CalendarDays className="h-5 w-5 text-blue-500" />}
        />
        
        <StatsCard
          title="Bookmakers Active"
          value={stats?.bookmarkersActive || '0/0'}
          change="All systems operational"
          icon={<BookOpen className="h-5 w-5 text-green-500" />}
        />
        
        <StatsCard
          title="Best Odds Found"
          value={stats?.bestOddsCount || 0}
          change={`${stats?.bestOddsChange > 0 ? '+' : ''}${stats?.bestOddsChange || 0} since last update`}
          icon={<ShieldAlert className="h-5 w-5 text-orange-500" />}
        />
        
        <StatsCard
          title="Last Scrape Time"
          value={stats?.lastScrapeTime || 'N/A'}
          change={`Next update in ${stats?.timeToNextUpdate || 15} mins`}
          icon={<Clock className="h-5 w-5 text-primary" />}
          iconColor="text-primary"
          changeColor="text-gray-500 dark:text-gray-400"
        />
      </div>
      
      {/* Control Panel */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-4 shadow">
        <div className="flex items-center mb-3">
          <Filter className="h-5 w-5 mr-2 text-primary" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Filter Events</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Country Filter */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <GlobeIcon className="h-4 w-4 mr-1.5 text-gray-500" />
              Country
            </label>
            <Select
              value={countryFilter}
              onValueChange={setCountryFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="england">England</SelectItem>
                <SelectItem value="spain">Spain</SelectItem>
                <SelectItem value="germany">Germany</SelectItem>
                <SelectItem value="italy">Italy</SelectItem>
                <SelectItem value="france">France</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Tournament Filter */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <Trophy className="h-4 w-4 mr-1.5 text-gray-500" />
              Tournament
            </label>
            <Select
              value={tournamentFilter}
              onValueChange={setTournamentFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Tournament" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tournaments</SelectItem>
                <SelectItem value="premier-league">Premier League</SelectItem>
                <SelectItem value="la-liga">La Liga</SelectItem>
                <SelectItem value="bundesliga">Bundesliga</SelectItem>
                <SelectItem value="serie-a">Serie A</SelectItem>
                <SelectItem value="ligue-1">Ligue 1</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Clear Filters Button */}
          <div className="flex items-end">
            <Button 
              variant="outline" 
              className="flex items-center" 
              onClick={() => {
                setCountryFilter('all');
                setTournamentFilter('all');
              }}
            >
              <X className="h-4 w-4 mr-1.5" /> 
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* View Options */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 mb-6 shadow flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <div className="flex items-center">
          <Trophy className="h-5 w-5 mr-2 text-primary" />
          <div className="text-lg font-semibold text-gray-800 dark:text-white">
            {sportTitle} Events
          </div>
          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {filteredEvents.length} events
          </span>
        </div>
        
        <div className="flex items-center space-x-3 text-sm">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              className={viewMode === 'grid' 
                ? "rounded-l-md text-white" 
                : "rounded-l-md text-gray-700 dark:text-gray-200"}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Grid
            </Button>
            
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              className={viewMode === 'table' 
                ? "rounded-r-md text-white" 
                : "rounded-r-md text-gray-700 dark:text-gray-200"}
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4 mr-1.5" />
              Table
            </Button>
          </div>
          
          <Select
            value={marketFilter}
            onValueChange={setMarketFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Market" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              <SelectItem value="match-result">Match Result</SelectItem>
              <SelectItem value="over-under">Over/Under</SelectItem>
              <SelectItem value="btts">Both Teams to Score</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Events Table */}
      <OddsTable 
        events={filteredEvents} 
        isLoading={isLoadingEvents}
        className="mb-8"
      />
      
      {/* Footer Note */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 mb-4">
        <p>Odds are updated every 15 minutes from 4 major bookmakers.</p>
        <p className="mt-1">Last updated: {stats?.lastScrapeTime || 'N/A'}</p>
      </div>
    </Layout>
  );
}
