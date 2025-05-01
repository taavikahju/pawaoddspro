import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import CountryFlag from '@/components/CountryFlag';
import { cn } from '@/lib/utils';

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
  
  // Function to determine country code from country name
  const getCountryCode = (countryName: string): string => {
    const countryCodeMap: Record<string, string> = {
      'England': 'GB',
      'Spain': 'ES',
      'Germany': 'DE',
      'Italy': 'IT',
      'France': 'FR',
      'Netherlands': 'NL',
      'Portugal': 'PT',
      'Brazil': 'BR',
      'Argentina': 'AR',
      'Belgium': 'BE',
      'Scotland': 'GB-SCT',
      'Wales': 'GB-WLS',
      'Austria': 'AT',
      'Denmark': 'DK',
      'Sweden': 'SE',
      'Norway': 'NO',
      'Switzerland': 'CH',
      'Greece': 'GR',
      'Turkey': 'TR',
      'Russia': 'RU',
      'Ukraine': 'UA',
      'Poland': 'PL',
      'Czech Republic': 'CZ',
      'Romania': 'RO',
      'Hungary': 'HU',
      'Croatia': 'HR',
      'Serbia': 'RS',
      'Slovenia': 'SI',
      'Slovakia': 'SK',
      'Finland': 'FI',
      'USA': 'US',
      'Canada': 'CA',
      'Mexico': 'MX',
      'Japan': 'JP',
      'South Korea': 'KR',
      'Australia': 'AU',
      'New Zealand': 'NZ',
      'South Africa': 'ZA',
      'Egypt': 'EG',
      'Morocco': 'MA',
      'Nigeria': 'NG',
      'Ghana': 'GH',
      'Kenya': 'KE',
      'Uganda': 'UG',
      'Tanzania': 'TZ',
      // Add more country mappings as needed
    };
    
    return countryCodeMap[countryName] || 'XX';
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
  
  // Function to determine color class for margin value
  const getMarginColorClass = (margin: number): string => {
    if (margin < 1.0) return 'text-green-600 dark:text-green-400';
    if (margin < 5.0) return 'text-blue-600 dark:text-blue-400';
    if (margin < 8.0) return 'text-yellow-600 dark:text-yellow-400';
    if (margin < 12.0) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };
  
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Tournament Margins</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left sidebar with countries list */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Countries</span>
              <span className="text-sm text-muted-foreground">
                {filteredCountries?.length || 0}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search countries or tournaments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                Failed to load countries data
              </div>
            ) : filteredCountries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No countries found matching your search
              </div>
            ) : (
              <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-2">
                {filteredCountries.map(country => (
                  <div 
                    key={country.name}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent",
                      selectedCountry === country.name && "bg-accent"
                    )}
                    onClick={() => setSelectedCountry(country.name)}
                  >
                    <CountryFlag 
                      countryCode={getCountryCode(country.name)} 
                      countryName={country.name}
                      size="md"
                    />
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {country.tournaments.length}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Right content area with tournament margins table */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>
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
              <div className="text-center py-8 text-muted-foreground">
                Select a country from the list to view tournaments and margins
              </div>
            ) : selectedCountryData.tournaments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tournaments available for {selectedCountryData.name}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="w-[300px]">Tournament</TableHead>
                      {bookmakers.map(bookmaker => (
                        <TableHead key={bookmaker.code} className="text-center">
                          {bookmaker.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCountryData.tournaments.map((tournament, idx) => (
                      <TableRow 
                        key={tournament.name}
                        className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                      >
                        <TableCell className="font-medium">
                          {tournament.name}
                        </TableCell>
                        
                        {bookmakers.map(bookmaker => {
                          const marginData = tournament.bookmakers[bookmaker.code];
                          
                          if (!marginData) {
                            return (
                              <TableCell key={bookmaker.code} className="text-center">
                                <span className="text-sm font-medium px-1 py-0.5 rounded bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                  -
                                </span>
                              </TableCell>
                            );
                          }
                          
                          const marginValue = marginData.margin;
                          const marginColorClass = getMarginColorClass(marginValue);
                          
                          return (
                            <TableCell key={bookmaker.code} className="text-center">
                              <span 
                                className={cn(
                                  "text-sm font-medium px-2 py-1 rounded bg-gray-50 dark:bg-gray-800",
                                  marginColorClass
                                )}
                                title={`Based on ${marginData.eventCount} events (Updated: ${new Date(marginData.timestamp).toLocaleString()})`}
                              >
                                {marginValue.toFixed(2)}%
                              </span>
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
    </div>
  );
};

export default TournamentMargins;