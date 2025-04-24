import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactCountryFlag from 'react-country-flag';
import Layout from '@/components/Layout';
import OddsTable from '@/components/OddsTable';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Trophy,
  X,
  GlobeIcon,
  Clock
} from 'lucide-react';

export default function Dashboard() {
  const [countryFilter, setCountryFilter] = useState('all');
  const [tournamentFilter, setTournamentFilter] = useState('all');
  const { selectedSports } = useBookmakerContext();
  
  // Available countries and tournaments (will be populated from data)
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [availableTournaments, setAvailableTournaments] = useState<string[]>([]);
  
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

  // Extract available countries and tournaments from the data
  useEffect(() => {
    if (events && Array.isArray(events) && events.length > 0) {
      // Extract unique countries
      const countries = Array.from(new Set(
        events
          .map((event: any) => event.country)
          .filter((country): country is string => Boolean(country))
      )).sort();
      
      setAvailableCountries(countries);
      
      // Extract tournaments from the selected country or all tournaments if no country is selected
      if (countryFilter !== 'all') {
        // First, normalize the country filter for case-insensitive comparison
        const normalizedCountryFilter = countryFilter.toLowerCase();
        
        const tournaments = Array.from(new Set(
          events
            // Match country case-insensitively
            .filter((event: any) => 
              event.country && 
              event.country.toLowerCase() === normalizedCountryFilter
            )
            .map((event: any) => event.tournament)
            .filter((tournament): tournament is string => Boolean(tournament))
        )).sort();
        
        setAvailableTournaments(tournaments);
      } else {
        const allTournaments = Array.from(new Set(
          events
            .map((event: any) => event.tournament)
            .filter((tournament): tournament is string => Boolean(tournament))
        )).sort();
        
        setAvailableTournaments(allTournaments);
      }
    }
  }, [events, countryFilter]);
  
  // Reset tournament filter when country filter changes
  useEffect(() => {
    setTournamentFilter('all');
  }, [countryFilter]);

  // Filter events by selected sports, country, and tournament
  const filteredEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    
    // First filter the events based on criteria
    const filtered = events.filter((event: any) => {
      // Filter by sport
      const sportMatches = selectedSports.some((selectedSport) => {
        // Map sport codes to IDs
        const sportMap: Record<string, number> = {
          'football': 1,
          'basketball': 2,
          'tennis': 3,
          'horseracing': 4
        };
        
        return sportMap[selectedSport] === event.sportId;
      });
      
      if (!sportMatches) return false;
      
      // Filter by country
      const countryMatches = countryFilter === 'all' || 
        (event.country && event.country === countryFilter);
      
      if (!countryMatches) return false;
      
      // Filter by tournament only if country is selected
      if (countryFilter !== 'all' && tournamentFilter !== 'all') {
        return event.tournament === tournamentFilter;
      }
      
      return true;
    });
    
    // Then sort by date and time (in ascending order)
    return filtered.sort((a, b) => {
      // First sort by date
      const dateComparison = a.date.localeCompare(b.date);
      if (dateComparison !== 0) {
        return dateComparison;
      }
      
      // If dates are the same, sort by time
      return a.time.localeCompare(b.time);
    });
  }, [events, selectedSports, countryFilter, tournamentFilter]);
  
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
  
  // Get country code for flag display
  const getCountryCode = (countryName: string): string => {
    // Map to standard ISO country codes
    const countryCodeMap: Record<string, string> = {
      'Kenya': 'KE',
      'Ghana': 'GH',
      'Nigeria': 'NG',
      'England': 'GB',
      'Spain': 'ES',
      'Germany': 'DE',
      'Italy': 'IT',
      'France': 'FR',
      'Portugal': 'PT',
      'Netherlands': 'NL',
      'Belgium': 'BE',
      'Brazil': 'BR',
      'Argentina': 'AR',
      'Mexico': 'MX',
      'USA': 'US',
      'United States': 'US',
      'Canada': 'CA',
      'Australia': 'AU',
      'Japan': 'JP',
      'China': 'CN',
      'India': 'IN',
      'South Africa': 'ZA',
      'Egypt': 'EG',
      'Morocco': 'MA',
      'Tunisia': 'TN',
      'Algeria': 'DZ',
      'Senegal': 'SN',
      'Cameroon': 'CM',
      'Ivory Coast': 'CI',
      'Tanzania': 'TZ',
      'Uganda': 'UG',
      'South Korea': 'KR',
      'Turkey': 'TR',
      'Russia': 'RU',
      'Ukraine': 'UA',
      'Poland': 'PL',
      'Sweden': 'SE',
      'Norway': 'NO',
      'Denmark': 'DK',
      'Finland': 'FI',
      'Switzerland': 'CH',
      'Austria': 'AT',
      'Czech Republic': 'CZ',
      'Croatia': 'HR',
      'Serbia': 'RS',
      'Greece': 'GR',
      'Romania': 'RO',
      'Bulgaria': 'BG',
      'Hungary': 'HU',
      'Scotland': 'GB-SCT',
      'Wales': 'GB-WLS',
      'Northern Ireland': 'GB-NIR',
      'Ireland': 'IE',
      'Saudi Arabia': 'SA',
      'Qatar': 'QA',
      'UAE': 'AE',
      'United Arab Emirates': 'AE'
    };
    
    return countryCodeMap[countryName] || 'XX'; // XX is used for unknown
  };
  
  // Get the sport name based on the first event in filtered list
  const sportTitle = filteredEvents.length > 0 
    ? getSportName(filteredEvents[0].sportId) 
    : 'All Sports';
  
  return (
    <Layout
    >
      {/* Minimal Control Panel */}
      <div className="bg-white dark:bg-slate-800 rounded-t-lg p-2 shadow border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Country Filter */}
            <Select
              value={countryFilter}
              onValueChange={setCountryFilter}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                {countryFilter === 'all' ? (
                  <div className="flex items-center">
                    <GlobeIcon className="h-3 w-3 mr-1 text-gray-500" />
                    <span>Country</span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <ReactCountryFlag 
                      countryCode={getCountryCode(countryFilter)} 
                      svg 
                      style={{
                        width: '1em',
                        height: '1em',
                        marginRight: '0.3rem'
                      }}
                      title={countryFilter}
                    />
                    <span>{countryFilter}</span>
                  </div>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center">
                    <GlobeIcon className="h-4 w-4 mr-2 text-gray-500" />
                    <span>All Countries</span>
                  </div>
                </SelectItem>
                {availableCountries.map((country) => (
                  <SelectItem key={country} value={country}>
                    <div className="flex items-center">
                      <ReactCountryFlag 
                        countryCode={getCountryCode(country)} 
                        svg 
                        style={{
                          width: '1.2em',
                          height: '1.2em',
                          marginRight: '0.5rem'
                        }}
                        title={country}
                      />
                      <span>{country}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Tournament Filter */}
            <Select
              value={tournamentFilter}
              onValueChange={setTournamentFilter}
              disabled={countryFilter === 'all'}
            >
              <SelectTrigger className={`h-8 w-[160px] text-xs ${countryFilter === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Trophy className="h-3 w-3 mr-1 text-gray-500" />
                <SelectValue placeholder={countryFilter === 'all' ? 'Select Country First' : 'Tournament'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tournaments</SelectItem>
                {availableTournaments.map((tournament) => (
                  <SelectItem key={tournament} value={tournament}>
                    {tournament}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Clear Filters Button */}
            <Button 
              variant="outline" 
              className="h-8 flex items-center px-2 text-xs" 
              onClick={() => {
                setCountryFilter('all');
                setTournamentFilter('all');
              }}
              size="sm"
            >
              <X className="h-3 w-3 mr-1" /> 
              Clear
            </Button>
              
            {/* Events count */}
            <div className="flex items-center">
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {filteredEvents.length} events
              </span>
            </div>
          </div>
          
          {/* Updated indicator */}
          <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            Updated: {stats?.lastScrapeTime || 'N/A'}
          </div>
        </div>
      </div>

      {/* Events Table */}
      <OddsTable 
        events={filteredEvents} 
        isLoading={isLoadingEvents}
        className="mb-4 rounded-t-none"
      />
      
      {/* Compact Footer Note */}
      <div className="text-center text-xs text-gray-400 mb-2">
        Odds are updated every 15 minutes from 4 major bookmakers
      </div>
    </Layout>
  );
}
