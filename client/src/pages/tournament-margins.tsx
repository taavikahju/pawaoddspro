import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ChevronRight, X, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import CountryFlag from '@/components/CountryFlag';
import { cn } from '@/lib/utils';
import Layout from '@/components/Layout';
import TournamentMarginHistoryPopup from '@/components/TournamentMarginHistoryPopup';

// Custom type for country data structure
interface CountryData {
  name: string;
  tournaments: TournamentData[];
}

interface TournamentData {
  name: string;
  bookmakers: Record<string, BookmakerMarginData>;
}

interface BookmakerMarginData {
  margin: number;
  eventCount: number;
  timestamp: string;
}

const TournamentMargins: React.FC = () => {
  const { bookmakers } = useBookmakerContext();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [historyPopupOpen, setHistoryPopupOpen] = useState(false);
  const [selectedHistoryData, setSelectedHistoryData] = useState<{
    tournamentName: string;
    bookmakerCode: string;
    bookmakerName: string;
    countryName: string; // Add country name to history data
  } | null>(null);
  
  // Function to determine country code from country name
  const getCountryCode = (countryName: string): string => {
    // Normalize country name for matching
    const normalizedName = countryName.trim();
    
    const countryCodeMap: Record<string, string> = {
      // Europe
      'England': 'GB-ENG',
      'England Amateur': 'GB-ENG',
      'United Kingdom': 'GB',
      'Great Britain': 'GB',
      'Spain': 'ES',
      'Spain Amateur': 'ES',
      'Germany': 'DE',
      'Germany Amateur': 'DE',
      'Italy': 'IT',
      'France': 'FR',
      'Netherlands': 'NL',
      'Portugal': 'PT',
      'Belgium': 'BE',
      'Scotland': 'GB-SCT',
      'Northern Ireland': 'GB-NIR',
      'Wales': 'GB-WLS',
      'Republic of Ireland': 'IE',
      'Ireland': 'IE',
      'Austria': 'AT',
      'Austria Amateur': 'AT',
      'Denmark': 'DK',
      'Sweden': 'SE',
      'Sweden Amateur': 'SE',
      'Norway': 'NO',
      'Switzerland': 'CH',
      'Greece': 'GR',
      'Turkey': 'TR',
      'Turkiye': 'TR',
      'Turkiye Amateur': 'TR',
      'Russia': 'RU',
      'Russian Federation': 'RU',
      'Ukraine': 'UA',
      'Poland': 'PL',
      'Czech Republic': 'CZ',
      'Czechia': 'CZ',
      'Romania': 'RO',
      'Hungary': 'HU',
      'Croatia': 'HR',
      'Serbia': 'RS',
      'Slovenia': 'SI',
      'Slovakia': 'SK',
      'Finland': 'FI',
      'Bulgaria': 'BG',
      'Albania': 'AL',
      'Montenegro': 'ME',
      'Estonia': 'EE',
      'Latvia': 'LV',
      'Lithuania': 'LT',
      'Belarus': 'BY',
      'Moldova': 'MD',
      'Cyprus': 'CY',
      'Malta': 'MT',
      'Luxembourg': 'LU',
      'Iceland': 'IS',
      'Faroe Islands': 'FO',
      'Armenia': 'AM',
      'Azerbaijan': 'AZ',
      'Georgia': 'GE',
      'San Marino': 'SM',
      
      // Americas
      'USA': 'US',
      'United States': 'US',
      'Canada': 'CA',
      'Mexico': 'MX',
      'Brazil': 'BR',
      'Argentina': 'AR',
      'Colombia': 'CO',
      'Chile': 'CL',
      'Peru': 'PE',
      'Uruguay': 'UY',
      'Paraguay': 'PY',
      'Ecuador': 'EC',
      'Bolivia': 'BO',
      'Venezuela': 'VE',
      'Costa Rica': 'CR',
      'Panama': 'PA',
      'Honduras': 'HN',
      'El Salvador': 'SV',
      'Guatemala': 'GT',
      'Jamaica': 'JM',
      'Trinidad and Tobago': 'TT',
      'Cuba': 'CU',
      'Dominican Republic': 'DO',
      'Nicaragua': 'NI',
      
      // Asia
      'Japan': 'JP',
      'South Korea': 'KR',
      'Republic of Korea': 'KR',
      'China': 'CN',
      'India': 'IN',
      'Thailand': 'TH',
      'Vietnam': 'VN',
      'Indonesia': 'ID',
      'Malaysia': 'MY',
      'Singapore': 'SG',
      'Cambodia': 'KH',
      'Philippines': 'PH',
      'Saudi Arabia': 'SA',
      'UAE': 'AE',
      'United Arab Emirates': 'AE',
      'Qatar': 'QA',
      'Iran': 'IR',
      'Iraq': 'IQ',
      'Israel': 'IL',
      'Jordan': 'JO',
      'Lebanon': 'LB',
      'Kazakhstan': 'KZ',
      'Uzbekistan': 'UZ',
      'Bahrain': 'BH',
      
      // Oceania
      'Australia': 'AU',
      'New Zealand': 'NZ',
      'Fiji': 'FJ',
      
      // Africa
      'South Africa': 'ZA',
      'Egypt': 'EG',
      'Morocco': 'MA',
      'Tunisia': 'TN',
      'Algeria': 'DZ',
      'Nigeria': 'NG',
      'Ghana': 'GH',
      'Kenya': 'KE',
      'Uganda': 'UG',
      'Tanzania': 'TZ',
      'Senegal': 'SN',
      'Ivory Coast': 'CI',
      'Cameroon': 'CM',
      'Zambia': 'ZM',
      'Zimbabwe': 'ZW',
      'Ethiopia': 'ET',
      'Guinea': 'GN',
      'Burkina Faso': 'BF',
      'Mali': 'ML',
      'Botswana': 'BW',
      'Rwanda': 'RW',
      'Sudan': 'SD',
      'Libya': 'LY',
      'Mozambique': 'MZ',
      'Angola': 'AO',
      'Malawi': 'MW',
      'Gambia': 'GM',
      'Sierra Leone': 'SL',
      'Togo': 'TG',
    };
    
    return countryCodeMap[normalizedName] || 'XX';
  };
  
  // Query to load tournament margin data
  const { data: countriesData, isLoading, error } = useQuery<CountryData[]>({
    queryKey: ['/api/tournaments/margins/by-country'],
  });
  
  // Filter countries based on search term
  const filteredCountries = useMemo(() => {
    if (!countriesData) return [];
    
    if (!searchTerm) return countriesData;
    
    return countriesData.filter(country => 
      country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      country.tournaments.some(tournament => 
        tournament.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [countriesData, searchTerm]);
  
  // Get the selected country data
  const selectedCountryData = useMemo(() => {
    if (!selectedCountry || !countriesData) return null;
    
    return countriesData.find(country => country.name === selectedCountry) || null;
  }, [selectedCountry, countriesData]);
  
  // Function to determine color class for margin value - matching OddsTable colors exactly
  const getMarginColorClass = (margin: number): string => {
    // Convert decimal to percentage (e.g., 0.0364 → 3.64%)
    const percentage = margin * 100;
    
    if (percentage < 5.0) return 'text-green-600 dark:text-green-500';
    if (percentage < 7.5) return 'text-lime-600 dark:text-lime-500';
    if (percentage < 10.0) return 'text-amber-600 dark:text-amber-500';
    if (percentage < 12.5) return 'text-orange-600 dark:text-orange-500';
    return 'text-red-600 dark:text-red-500';
  };
  
  // Function to check if a tournament has significant margin differences for betPawa
  const hasSignificantMarginDifference = (tournament: TournamentData): boolean => {
    const betPawaGhMargin = tournament.bookmakers['bp GH']?.margin;
    const betPawaKeMargin = tournament.bookmakers['bp KE']?.margin;
    
    // If no betPawa margins, return false
    if (!betPawaGhMargin && !betPawaKeMargin) return false;
    
    // Get all other bookmaker margins
    const otherMarginsMap = Object.entries(tournament.bookmakers)
      .filter(([code]) => code !== 'bp GH' && code !== 'bp KE')
      .map(([_, data]) => data.margin);
    
    // If no other margins to compare, return false
    if (otherMarginsMap.length === 0) return false;
    
    // Check if any betPawa margin is at least 2.5% higher or lower than any other margin
    const thresholdDifference = 0.025; // 2.5%
    
    if (betPawaGhMargin) {
      for (const otherMargin of otherMarginsMap) {
        if (otherMargin && Math.abs(betPawaGhMargin - otherMargin) >= thresholdDifference) {
          return true;
        }
      }
    }
    
    if (betPawaKeMargin) {
      for (const otherMargin of otherMarginsMap) {
        if (otherMargin && Math.abs(betPawaKeMargin - otherMargin) >= thresholdDifference) {
          return true;
        }
      }
    }
    
    return false;
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  return (
    <Layout title="Tournament Margins" subtitle="Average bookmaker margins by tournament">
      <div className="flex flex-col md:flex-row h-full gap-4 dark:bg-[#20293A]">
        {/* Collapsible sidebar toggle for mobile */}
        <div className="md:hidden flex justify-between items-center mb-4">
          <h2 className="font-medium text-sm">Countries</h2>
          <button 
            onClick={toggleSidebar} 
            className="p-1 rounded-md hover:bg-muted"
          >
            <ChevronRight className={`h-5 w-5 transition-transform ${sidebarCollapsed ? '' : 'rotate-90'}`} />
          </button>
        </div>
        
        {/* Left sidebar with countries list */}
        <Card 
          className={`md:w-60 flex-shrink-0 ${sidebarCollapsed ? 'hidden' : 'block'} md:block bg-transparent shadow-none border-muted`}
          style={{ height: 'calc(100vh - 180px)' }}
        >
          <CardHeader className="py-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Countries</span>
              <span className="text-xs text-muted-foreground">
                {filteredCountries?.length || 0}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="relative mb-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-black dark:text-white" />
                <Input
                  placeholder="Search countries and tournaments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 py-5 h-9 bg-muted/40 border-muted focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/50 transition-colors text-black dark:text-white"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-black dark:text-white hover:opacity-80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchTerm && (
                <div className="mt-1.5 text-xs text-black dark:text-white flex justify-between px-1">
                  <span>Searching: "{searchTerm}"</span>
                  <span>{filteredCountries.length} results</span>
                </div>
              )}
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-6 text-red-500 text-sm">
                Failed to load countries
              </div>
            ) : filteredCountries.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No countries found
              </div>
            ) : (
              <div className="space-y-1 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar" style={{ maxHeight: 'calc(100vh - 250px)', width: '100%' }}>
                {filteredCountries.map(country => {
                  // Get total tournament count
                  const tournamentCount = country.tournaments.length;
                  // Get the country code for flag display
                  const countryCode = getCountryCode(country.name);
                  // Check if any tournaments in this country have significant differences
                  const hasAnySignificantDifference = country.tournaments.some(tournament => 
                    hasSignificantMarginDifference(tournament)
                  );
                  
                  return (
                    <div 
                      key={country.name}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 text-sm",
                        selectedCountry === country.name 
                          ? "bg-primary/10 dark:bg-primary/20 border-l-4 border-primary shadow-sm" 
                          : "hover:bg-accent border-l-4 border-transparent"
                      )}
                      onClick={() => setSelectedCountry(country.name)}
                    >
                      <div className="relative">
                        <CountryFlag 
                          countryCode={countryCode} 
                          countryName={country.name}
                          size="sm"
                          className="shadow-sm rounded-sm"
                        />
                      </div>
                      <span className={cn(
                        "flex-1 truncate", 
                        selectedCountry === country.name && "font-medium"
                      )}>
                        {country.name}
                      </span>
                      
                      {hasAnySignificantDifference && (
                        <span className="text-red-500 font-bold" title="Contains tournaments with significant margin differences">
                          ⚠️
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Right content area with tournament margins table */}
        <Card className="flex-1 bg-transparent shadow-none border-muted">
          <CardHeader className="py-4">
            <CardTitle className="text-lg flex items-center">
              {selectedCountryData && (
                <>
                  <CountryFlag 
                    countryCode={getCountryCode(selectedCountryData.name)} 
                    countryName={selectedCountryData.name}
                    size="md"
                    className="mr-2"
                  />
                </>
              )}
              {selectedCountryData 
                ? `${selectedCountryData.name} Tournaments (${selectedCountryData.tournaments.length})` 
                : 'Tournament Margins'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                Failed to load tournament margins data
              </div>
            ) : !selectedCountryData ? (
              <div className="text-center py-8 text-black dark:text-white">
                Select a country from the list to view tournaments and margins
              </div>
            ) : selectedCountryData.tournaments.length === 0 ? (
              <div className="text-center py-8 text-black dark:text-white">
                No tournaments available for {selectedCountryData.name}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="bg-gray-100 dark:bg-slate-700/50 border-b border-gray-200 dark:border-gray-700">
                      <TableHead className="w-[250px] px-2 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                        <div className="flex items-center">
                          <Trophy className="w-3 h-3 mr-1" />
                          Tournament
                        </div>
                      </TableHead>
                      {bookmakers.map(bookmaker => (
                        <TableHead key={bookmaker.code} className="px-2 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                          {bookmaker.code === 'bp GH' 
                            ? 'betPawa GH'
                            : bookmaker.code === 'bp KE'
                              ? 'betPawa KE'
                              : bookmaker.name.replace(' Kenya', '').replace(' Ghana', '')}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCountryData.tournaments
                      // Sort tournaments by the sum of all margins (ascending)
                      .sort((a, b) => {
                        // Calculate average margin for each tournament across all bookmakers
                        const getAverageMargin = (t: TournamentData) => {
                          let totalMargin = 0;
                          let count = 0;
                          
                          Object.values(t.bookmakers).forEach(bm => {
                            if (bm.margin) {
                              totalMargin += bm.margin;
                              count++;
                            }
                          });
                          
                          return count > 0 ? totalMargin / count : 999; // Put tournaments with no margins last
                        };
                        
                        return getAverageMargin(a) - getAverageMargin(b);
                      })
                      .map((tournament, idx) => (
                      <TableRow 
                        key={tournament.name}
                        className={idx % 2 === 0 ? 'bg-background hover:bg-muted/40' : 'bg-muted/30 hover:bg-muted/50'}
                      >
                        <TableCell className="font-medium text-xs py-1.5 px-2 whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-1">
                            {tournament.name}
                            {hasSignificantMarginDifference(tournament) && (
                              <span className="text-red-500" title="Significant margin difference detected for betPawa GH/KE">
                                ⚠️
                              </span>
                            )}
                          </div>
                        </TableCell>
                        
                        {bookmakers.map(bookmaker => {
                          // Use the bookmaker code directly - no conversion needed
                          const marginData = tournament.bookmakers[bookmaker.code];
                          
                          if (!marginData) {
                            return (
                              <TableCell key={bookmaker.code} className="text-center py-1.5 px-2 whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                                <span className="text-xs font-medium px-2 py-1 rounded bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                                  -
                                </span>
                              </TableCell>
                            );
                          }
                          
                          const marginValue = marginData.margin;
                          const marginColorClass = getMarginColorClass(marginValue);
                          
                          return (
                            <TableCell key={bookmaker.code} className="text-center py-1.5 px-2 whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                              <button
                                onClick={() => {
                                  setSelectedHistoryData({
                                    tournamentName: tournament.name,
                                    bookmakerCode: bookmaker.code,
                                    bookmakerName: bookmaker.name,
                                    countryName: selectedCountryData.name // Include the country name
                                  });
                                  setHistoryPopupOpen(true);
                                }}
                                className={cn(
                                  "text-xs font-medium px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150 ease-in-out",
                                  marginColorClass
                                )}
                                title={`Based on ${marginData.eventCount} events (Updated: ${new Date(marginData.timestamp).toLocaleString()}). Click to view history.`}
                              >
                                {(marginValue * 100).toFixed(2)}%
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Margin history popup */}
      {selectedHistoryData && (
        <TournamentMarginHistoryPopup
          open={historyPopupOpen}
          onOpenChange={setHistoryPopupOpen}
          tournamentName={selectedHistoryData.tournamentName}
          bookmakerCode={selectedHistoryData.bookmakerCode}
          bookmakerName={selectedHistoryData.bookmakerName}
          countryName={selectedHistoryData.countryName}
        />
      )}
    </Layout>
  );
};

export default TournamentMargins;