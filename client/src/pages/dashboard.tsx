import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import CountryFlag from '@/components/CountryFlag';
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
    data: stats = { lastScrapeTime: 'N/A' },
    isLoading: isLoadingStats 
  } = useQuery<{ lastScrapeTime: string }>({ 
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
    // Standardize country name (remove any special characters and convert to lowercase)
    const normalizedName = countryName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
    
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
      console.debug(`No country code found for: "${countryName}" (normalized: "${normalizedName}")`);
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
                {availableCountries.map((country) => (
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
