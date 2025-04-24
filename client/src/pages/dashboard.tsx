import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import OddsTable from '@/components/OddsTable';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LayoutGrid, 
  List, 
  Trophy,
  X,
  Filter,
  GlobeIcon,
  Clock
} from 'lucide-react';

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
      {/* Compact Control Panel */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-3 mb-4 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left side - Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Country Filter */}
            <div>
              <Select
                value={countryFilter}
                onValueChange={setCountryFilter}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <GlobeIcon className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Country" />
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
            <div>
              <Select
                value={tournamentFilter}
                onValueChange={setTournamentFilter}
              >
                <SelectTrigger className="h-9 w-[150px]">
                  <Trophy className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Tournament" />
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
            <Button 
              variant="outline" 
              className="h-9 flex items-center" 
              onClick={() => {
                setCountryFilter('all');
                setTournamentFilter('all');
              }}
              size="sm"
            >
              <X className="h-4 w-4 mr-1" /> 
              Clear
            </Button>
            
            {/* Events count */}
            <div className="flex items-center">
              <div className="text-sm font-semibold text-gray-800 dark:text-white">
                {sportTitle}
              </div>
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {filteredEvents.length} events
              </span>
            </div>
          </div>
          
          {/* Right side - View options */}
          <div className="flex items-center gap-2 text-sm">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                className={viewMode === 'grid' 
                  ? "h-9 rounded-l-md text-white" 
                  : "h-9 rounded-l-md text-gray-700 dark:text-gray-200"}
                onClick={() => setViewMode('grid')}
                size="sm"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Grid
              </Button>
              
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                className={viewMode === 'table' 
                  ? "h-9 rounded-r-md text-white" 
                  : "h-9 rounded-r-md text-gray-700 dark:text-gray-200"}
                onClick={() => setViewMode('table')}
                size="sm"
              >
                <List className="h-4 w-4 mr-1" />
                Table
              </Button>
            </div>
            
            <Select
              value={marketFilter}
              onValueChange={setMarketFilter}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Market" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="match-result">Match Result</SelectItem>
                <SelectItem value="over-under">Over/Under</SelectItem>
                <SelectItem value="btts">Both Teams to Score</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Last updated indicator */}
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              Updated: {stats?.lastScrapeTime || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <OddsTable 
        events={filteredEvents} 
        isLoading={isLoadingEvents}
        className="mb-4"
      />
      
      {/* Compact Footer Note */}
      <div className="text-center text-xs text-gray-400 mb-2">
        Odds are updated every 15 minutes from 4 major bookmakers
      </div>
    </Layout>
  );
}
