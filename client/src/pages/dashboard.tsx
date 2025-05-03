import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import CountryFlag from '@/components/CountryFlag';
import Layout from '@/components/Layout';
import OddsTable from '@/components/OddsTable';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
// We'll keep the import but use React Query directly in most places
import { useWebSocket } from '@/hooks/use-websocket';
import { useOfflineResilientEvents } from '@/hooks/use-offline-resilient-events';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  Trophy,
  X,
  GlobeIcon,
  Clock,
  Search
} from 'lucide-react';

export default function Dashboard() {
  const [countryFilter, setCountryFilter] = useState('all');
  const [tournamentFilter, setTournamentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedSports, minMarginFilter, maxMarginFilter, selectedBookmakers } = useBookmakerContext();
  
  // Available countries and tournaments (will be populated from data)
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [availableTournaments, setAvailableTournaments] = useState<string[]>([]);
  
  // Fetch stats data
  const { 
    data: stats = { lastScrapeTime: 'N/A' },
    isLoading: isLoadingStats 
  } = useQuery<{ lastScrapeTime: string }>({ 
    queryKey: ['/api/stats'],
    // Removed refetchInterval as data only updates after scraper runs (every 30 minutes)
  });
  
  // Use the offline-resilient events hook for better reliability with Sportybet data
  const { 
    events = [],
    isLoading: isLoadingEvents,
    error: eventsError,
    isError: isEventsError,
    testResilience
  } = useOfflineResilientEvents();

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

  // Function to calculate margin for an event and bookmaker
  const calculateMargin = (event: any, bookmakerCode: string): number | null => {
    const odds = event.oddsData?.[bookmakerCode];
    if (!odds) return null;
    
    const { home, draw, away } = odds;
    if (!home || !draw || !away) return null;
    
    // Calculate margin = (1/home + 1/draw + 1/away) - 1
    return (1/home + 1/draw + 1/away);
  };
  
  // Filter events by selected sports, country, tournament, search query, and margin
  const filteredEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    
    // Filter out past events by checking date and time
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const todayFormatted = `${dateString.split('-')[2]} ${dateString.split('-')[1]} ${dateString.split('-')[0]}`; // DD MM YYYY

    // Filter for upcoming events
    const upcomingEvents = events.filter((event: any) => {
      // First check if the event has a date
      if (!event.date) return false;
      
      // Compare dates - format is "DD MMM YYYY"
      const eventDate = event.date;
      
      // If event date is in the future, include it
      if (eventDate > todayFormatted) return true;
      
      // If event date is today, check the time
      if (eventDate === todayFormatted && event.time) {
        const eventTimeParts = event.time.split(':');
        if (eventTimeParts.length === 2) {
          const eventHour = parseInt(eventTimeParts[0], 10);
          const eventMinute = parseInt(eventTimeParts[1], 10);
          
          const currentHour = now.getUTCHours();
          const currentMinute = now.getUTCMinutes();
          
          // If event time is in the future, include it
          if (eventHour > currentHour || (eventHour === currentHour && eventMinute > currentMinute)) {
            return true;
          }
        }
      }
      
      // Otherwise, it's a past event
      return false;
    });
    
    // First filter the events based on criteria
    const filtered = upcomingEvents.filter((event: any) => {
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
        if (event.tournament !== tournamentFilter) return false;
      }
      
      // Filter by search query if provided
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const eventName = event.teams.toLowerCase();
        const tournamentName = (event.tournament || '').toLowerCase();
        const countryName = (event.country || '').toLowerCase();
        
        // Check if any of the event details match the search query
        const matchesSearch = 
          eventName.includes(query) || 
          tournamentName.includes(query) || 
          countryName.includes(query);
        
        if (!matchesSearch) return false;
      }
      
      // Filter by margin based on selected bookmakers
      // If min is 0 and max is 15, don't apply the filter (default state)
      if (!(minMarginFilter === 0 && maxMarginFilter === 15)) {
        // If no bookmakers are selected, don't apply margin filter
        if (selectedBookmakers.length === 0) return true;
        
        // Check if this event has any of the selected bookmakers with margins in range
        let hasBookmakerWithinMarginRange = false;
        
        // Only check margins for selected bookmakers
        for (const code of selectedBookmakers) {
          // Skip if this bookmaker doesn't have odds for this event
          if (!event.oddsData || !event.oddsData[code]) continue;
          
          // Calculate margin for this bookmaker
          const margin = calculateMargin(event, code);
          if (margin === null) continue;
          
          // Convert to percentage and check against thresholds
          const marginPercent = (margin - 1) * 100;
          
          if (marginPercent >= minMarginFilter && marginPercent <= maxMarginFilter) {
            hasBookmakerWithinMarginRange = true;
            break; // We found at least one bookmaker within margin range
          }
        }
        
        // If none of the selected bookmakers have margins within range, exclude event
        if (!hasBookmakerWithinMarginRange) return false;
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
  }, [events, selectedSports, selectedBookmakers, countryFilter, tournamentFilter, searchQuery, minMarginFilter, maxMarginFilter]);
  
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
    // Standardize country name (remove any special characters and convert to lowercase)
    const normalizedName = countryName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
    
    // Special cases for amateur leagues and country variants
    if (normalizedName.includes('amateur') || normalizedName.endsWith(' am')) {
      // For amateur leagues, use the base country flag
      if (normalizedName.includes('austria')) return 'AT';
      if (normalizedName.includes('czech') || normalizedName.includes('czechia')) return 'CZ';
      if (normalizedName.includes('england')) return 'GB-ENG';
      if (normalizedName.includes('germany')) return 'DE';
      if (normalizedName.includes('spain')) return 'ES';
      if (normalizedName.includes('sweden')) return 'SE';
    }
    
    // Additional special cases
    if (normalizedName.includes('turkiye')) return 'TR';
    if (normalizedName.includes('south korea') || normalizedName.includes('republic of korea')) return 'KR';
    if (normalizedName.includes('czechia')) return 'CZ';
    if (normalizedName.includes('faroe')) return 'FO';
    
    // Map to standard ISO country codes
    const countryCodeMap: Record<string, string> = {
      // African countries
      'algeria': 'DZ',
      'angola': 'AO',
      'benin': 'BJ',
      'botswana': 'BW',
      'burkina': 'BF',
      'burkinafaso': 'BF',
      'burundi': 'BI',
      'cameroon': 'CM',
      'cape verde': 'CV',
      'capeverde': 'CV',
      'central african republic': 'CF',
      'chad': 'TD',
      'comoros': 'KM',
      'congo': 'CG',
      'democratic republic of congo': 'CD',
      'djibouti': 'DJ',
      'egypt': 'EG',
      'equatorial guinea': 'GQ',
      'eritrea': 'ER',
      'ethiopia': 'ET',
      'gabon': 'GA',
      'gambia': 'GM',
      'ghana': 'GH',
      'guinea': 'GN',
      'guinea bissau': 'GW',
      'ivory coast': 'CI',
      'ivorycoast': 'CI',
      'cote divoire': 'CI',
      'cotedivoire': 'CI',
      'kenya': 'KE',
      'lesotho': 'LS',
      'liberia': 'LR',
      'libya': 'LY',
      'madagascar': 'MG',
      'malawi': 'MW',
      'mali': 'ML',
      'mauritania': 'MR',
      'mauritius': 'MU',
      'morocco': 'MA',
      'mozambique': 'MZ',
      'namibia': 'NA',
      'niger': 'NE',
      'nigeria': 'NG',
      'rwanda': 'RW',
      'sao tome and principe': 'ST',
      'senegal': 'SN',
      'seychelles': 'SC',
      'sierra leone': 'SL',
      'somalia': 'SO',
      'south africa': 'ZA',
      'southafrica': 'ZA',
      'south sudan': 'SS',
      'sudan': 'SD',
      'swaziland': 'SZ',
      'tanzania': 'TZ',
      'togo': 'TG',
      'tunisia': 'TN',
      'uganda': 'UG',
      'zambia': 'ZM',
      'zimbabwe': 'ZW',
      
      // European countries
      'albania': 'AL',
      'andorra': 'AD',
      'armenia': 'AM',
      'austria': 'AT',
      'azerbaijan': 'AZ',
      'belarus': 'BY',
      'belgium': 'BE',
      'bosnia': 'BA',
      'bosnia and herzegovina': 'BA',
      'bulgaria': 'BG',
      'croatia': 'HR',
      'cyprus': 'CY',
      'czech republic': 'CZ',
      'czechrepublic': 'CZ',
      'denmark': 'DK',
      'estonia': 'EE',
      'finland': 'FI',
      'france': 'FR',
      'georgia': 'GE',
      'germany': 'DE',
      'greece': 'GR',
      'hungary': 'HU',
      'iceland': 'IS',
      'ireland': 'IE',
      'italy': 'IT',
      'kazakhstan': 'KZ',
      'kosovo': 'XK',
      'latvia': 'LV',
      'liechtenstein': 'LI',
      'lithuania': 'LT',
      'luxembourg': 'LU',
      'malta': 'MT',
      'moldova': 'MD',
      'monaco': 'MC',
      'montenegro': 'ME',
      'netherlands': 'NL',
      'north macedonia': 'MK',
      'macedonia': 'MK',
      'norway': 'NO',
      'poland': 'PL',
      'portugal': 'PT',
      'romania': 'RO',
      'russia': 'RU',
      'russian federation': 'RU',
      'gibraltar': 'GI',
      'san marino': 'SM',
      'serbia': 'RS',
      'slovakia': 'SK',
      'slovenia': 'SI',
      'spain': 'ES',
      'sweden': 'SE',
      'switzerland': 'CH',
      'turkey': 'TR',
      'ukraine': 'UA',
      'united kingdom': 'GB',
      'uk': 'GB',
      'england': 'GB-ENG',
      'scotland': 'GB-SCT',
      'wales': 'GB-WLS',
      'northern ireland': 'GB-NIR',
      'vatican city': 'VA',
      
      // Americas
      'argentina': 'AR',
      'bahamas': 'BS',
      'barbados': 'BB',
      'belize': 'BZ',
      'bolivia': 'BO',
      'brazil': 'BR',
      'canada': 'CA',
      'chile': 'CL',
      'colombia': 'CO',
      'costa rica': 'CR',
      'costarica': 'CR',
      'cuba': 'CU',
      'dominica': 'DM',
      'dominican republic': 'DO',
      'dominicanrepublic': 'DO',
      'ecuador': 'EC',
      'el salvador': 'SV',
      'elsalvador': 'SV',
      'grenada': 'GD',
      'guatemala': 'GT',
      'guyana': 'GY',
      'haiti': 'HT',
      'honduras': 'HN',
      'jamaica': 'JM',
      'mexico': 'MX',
      'nicaragua': 'NI',
      'panama': 'PA',
      'paraguay': 'PY',
      'peru': 'PE',
      'saint kitts and nevis': 'KN',
      'saint lucia': 'LC',
      'saint vincent': 'VC',
      'suriname': 'SR',
      'trinidad and tobago': 'TT',
      'united states': 'US',
      'unitedstates': 'US',
      'usa': 'US',
      'uruguay': 'UY',
      'venezuela': 'VE',
      
      // Asian countries
      'afghanistan': 'AF',
      'bahrain': 'BH',
      'bangladesh': 'BD',
      'bhutan': 'BT',
      'brunei': 'BN',
      'cambodia': 'KH',
      'china': 'CN',
      'hong kong': 'HK',
      'india': 'IN',
      'indonesia': 'ID',
      'iran': 'IR',
      'iraq': 'IQ',
      'israel': 'IL',
      'japan': 'JP',
      'jordan': 'JO',
      'kuwait': 'KW',
      'kyrgyzstan': 'KG',
      'laos': 'LA',
      'lebanon': 'LB',
      'malaysia': 'MY',
      'maldives': 'MV',
      'mongolia': 'MN',
      'myanmar': 'MM',
      'nepal': 'NP',
      'north korea': 'KP',
      'northkorea': 'KP',
      'oman': 'OM',
      'pakistan': 'PK',
      'palestine': 'PS',
      'philippines': 'PH',
      'qatar': 'QA',
      'saudi arabia': 'SA',
      'saudiarabia': 'SA',
      'singapore': 'SG',
      'south korea': 'KR',
      'southkorea': 'KR',
      'sri lanka': 'LK',
      'srilanka': 'LK',
      'syria': 'SY',
      'taiwan': 'TW',
      'tajikistan': 'TJ',
      'thailand': 'TH',
      'timor leste': 'TL',
      'timorleste': 'TL',
      'east timor': 'TL',
      'easttimor': 'TL',
      'turkmenistan': 'TM',
      'united arab emirates': 'AE',
      'unitedarabemirates': 'AE',
      'uae': 'AE',
      'uzbekistan': 'UZ',
      'vietnam': 'VN',
      'yemen': 'YE',
      
      // Oceania
      'australia': 'AU',
      'fiji': 'FJ',
      'kiribati': 'KI',
      'marshall islands': 'MH',
      'marshallislands': 'MH',
      'micronesia': 'FM',
      'nauru': 'NR',
      'new zealand': 'NZ',
      'newzealand': 'NZ',
      'palau': 'PW',
      'papua new guinea': 'PG',
      'papuanewguinea': 'PG',
      'samoa': 'WS',
      'solomon islands': 'SB',
      'solomonislands': 'SB',
      'tonga': 'TO',
      'tuvalu': 'TV',
      'vanuatu': 'VU'
    };
    
    // Try to find the country code - try multiple variations
    const code = countryCodeMap[normalizedName] || 
                 countryCodeMap[normalizedName.replace(/\s/g, '')] || // Try without spaces
                 'XX'; // XX for unknown
    
    // Log country code mapping issues to help with troubleshooting
    if (code === 'XX' && countryName) {
      // Silently handle missing country codes
    }
    
    return code;
  };
  
  // Get the sport name based on the first event in filtered list
  const sportTitle = filteredEvents.length > 0 
    ? getSportName(filteredEvents[0].sportId) 
    : 'All Sports';
  
  return (
    <Layout
    >
      {/* Logo at the top */}
      <div className="bg-white dark:bg-slate-800 rounded-t-lg border-b border-gray-200 dark:border-gray-700 px-3 py-2">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">pawa<span className="text-[#00BCFF] text-xl font-bold">odds</span>.pro</h1>
      </div>

      {/* Minimal Control Panel */}
      <div className="bg-white dark:bg-slate-800 p-2 shadow border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Country Filter */}
            <Select
              value={countryFilter}
              onValueChange={setCountryFilter}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                {countryFilter === 'all' ? (
                  <div className="flex items-center">
                    <GlobeIcon className="h-3 w-3 mr-1 text-gray-500" />
                    <span>Country</span>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CountryFlag 
                      countryCode={getCountryCode(countryFilter)} 
                      countryName={countryFilter}
                      size="sm"
                      className="mr-1.5"
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
                
                {/* Top shortcut countries */}
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Popular Countries
                </div>
                {['England', 'France', 'Germany', 'Italy', 'Spain'].map((country) => (
                  <SelectItem key={country} value={country}>
                    <div className="flex items-center">
                      <CountryFlag 
                        countryCode={getCountryCode(country)} 
                        countryName={country}
                        size="md"
                        className="mr-2"
                      />
                      <span>{country}</span>
                    </div>
                  </SelectItem>
                ))}
                
                <Separator className="my-1" />
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  All Countries
                </div>
                
                {availableCountries
                  .filter(country => !['England', 'France', 'Germany', 'Italy', 'Spain'].includes(country))
                  .map((country) => (
                    <SelectItem key={country} value={country}>
                      <div className="flex items-center">
                        <CountryFlag 
                          countryCode={getCountryCode(country)} 
                          countryName={country}
                          size="md"
                          className="mr-2"
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
              <SelectTrigger className={`h-8 w-[200px] text-xs ${countryFilter === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
            
            {/* Smart Search Box */}
            <div className="relative">
              <Input
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-[200px] pl-8 text-xs"
              />
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-500" />
              {searchQuery && (
                <button 
                  className="absolute right-2.5 top-2"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-3.5 w-3.5 text-gray-500 hover:text-gray-700" />
                </button>
              )}
            </div>
            
            {/* Clear Filters Button */}
            <Button 
              variant="outline" 
              className="h-8 flex items-center px-2 text-xs" 
              onClick={() => {
                setCountryFilter('all');
                setTournamentFilter('all');
                setSearchQuery('');
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
          
          {/* Bookmaker Average Margins */}
          <div className="flex flex-col items-end bg-slate-100 dark:bg-slate-700 p-2 rounded-md border border-slate-200 dark:border-slate-600 shadow-sm">
            <div className="text-xs font-medium mb-1 text-slate-600 dark:text-slate-300">Average Bookmaker Margins</div>
            
            {(() => {
              // Calculate average margins for each selected bookmaker based on filtered events
              const bookmakerMargins: Record<string, { total: number, count: number }> = {};
              const { selectedBookmakers, bookmakers } = useBookmakerContext();
              
              // Create lookup for bookmaker names
              const bookmakerNames: Record<string, string> = {};
              bookmakers.forEach(b => {
                bookmakerNames[b.code] = b.name;
              });
              
              // Only calculate for selected bookmakers
              if (filteredEvents.length > 0 && selectedBookmakers.length > 0) {
                filteredEvents.forEach(event => {
                  selectedBookmakers.forEach(code => {
                    if (event.oddsData?.[code]) {
                      const homeOdds = event.oddsData[code].home;
                      const drawOdds = event.oddsData[code].draw;
                      const awayOdds = event.oddsData[code].away;
                      
                      if (homeOdds && drawOdds && awayOdds) {
                        // Calculate margin = (1/home + 1/draw + 1/away) - 1
                        const margin = (1/homeOdds + 1/drawOdds + 1/awayOdds);
                        
                        if (!bookmakerMargins[code]) {
                          bookmakerMargins[code] = { total: 0, count: 0 };
                        }
                        
                        bookmakerMargins[code].total += margin;
                        bookmakerMargins[code].count++;
                      }
                    }
                  });
                });
              }
              
              // Return margin displays for each bookmaker
              return Object.entries(bookmakerMargins)
                .filter(([_, data]) => data.count > 0) // Only show bookmakers with data
                .map(([code, data]) => {
                  const avgMargin = data.total / data.count;
                  const marginPercentage = ((avgMargin - 1) * 100).toFixed(2);
                  const bookmakerName = bookmakerNames[code] || code;
                  
                  // Get color coding based on the margin percentage
                  const getMarginColor = (value: number) => {
                    if (value < 5.0) return "bg-green-200 text-green-800 dark:bg-green-900/30 dark:text-green-300"; // Great margins (<5%)
                    if (value < 7.5) return "bg-lime-200 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300";    // Good margins (<7.5%)
                    if (value < 10.0) return "bg-amber-200 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"; // Average margins (<10%)
                    if (value < 12.5) return "bg-orange-200 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"; // High margins (<12.5%)
                    return "bg-red-200 text-red-800 dark:bg-red-900/30 dark:text-red-300"; // Very high margins (>=12.5%)
                  };
                  
                  const marginValue = parseFloat(marginPercentage);
                  const colorClass = getMarginColor(marginValue);
                  
                  return (
                    <div key={code} className="font-mono text-xs flex justify-between w-full mb-1 last:mb-0">
                      <span className="font-medium text-slate-700 dark:text-slate-200 mr-2">{bookmakerName}:</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded ${colorClass}`}>
                        {marginPercentage}%
                      </span>
                    </div>
                  );
                });
            })()}
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
