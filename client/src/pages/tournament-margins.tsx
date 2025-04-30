import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Triangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import CountryFlag from "@/components/CountryFlag";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Layout from '@/components/Layout';

// Type definitions
interface BookmakerMargin {
  value: number;
  timestamp: string;
}

interface TournamentMargins {
  id: number;
  country: string;
  tournament: string;
  margins: Record<string, BookmakerMargin>;
}

// Helper function to calculate if a margin is significantly different
const hasSignificantMarginDifference = (margins: Record<string, BookmakerMargin>, threshold = 2.5) => {
  const betpawaKeValue = margins['betpawa_ke']?.value;
  const betpawaGhValue = margins['betpawa_gh']?.value;
  
  if (!betpawaKeValue && !betpawaGhValue) return false;
  
  const allValues = Object.entries(margins)
    .filter(([key]) => key !== 'betpawa_ke' && key !== 'betpawa_gh')
    .map(([_, margin]) => margin.value);
  
  if (allValues.length === 0) return false;
  
  if (betpawaKeValue) {
    const betpawaKePercentage = (betpawaKeValue - 1) * 100;
    for (const value of allValues) {
      const otherPercentage = (value - 1) * 100;
      if (Math.abs(betpawaKePercentage - otherPercentage) >= threshold) {
        return true;
      }
    }
  }
  
  if (betpawaGhValue) {
    const betpawaGhPercentage = (betpawaGhValue - 1) * 100;
    for (const value of allValues) {
      const otherPercentage = (value - 1) * 100;
      if (Math.abs(betpawaGhPercentage - otherPercentage) >= threshold) {
        return true;
      }
    }
  }
  
  return false;
};

// Helper function to format margin as percentage
const formatMargin = (margin: number | undefined) => {
  if (margin === undefined) return '-';
  return ((margin - 1) * 100).toFixed(2) + '%';
};

// Helper function to determine cell color based on margin value
const getMarginColorClass = (margin: number | undefined) => {
  if (margin === undefined) return '';
  
  const percentage = (margin - 1) * 100;
  if (percentage < 5) return 'text-green-600 dark:text-green-400';
  if (percentage < 7.5) return 'text-lime-600 dark:text-lime-400';
  if (percentage < 10) return 'text-amber-600 dark:text-amber-400';
  if (percentage < 12.5) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};

// Helper to check if timestamp is older than 12 hours
const isOld = (timestamp: string) => {
  const now = new Date();
  const marginTime = new Date(timestamp);
  const diffHours = (now.getTime() - marginTime.getTime()) / (1000 * 60 * 60);
  return diffHours > 12;
};

const TournamentMargins = () => {
  const { toast } = useToast();
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});

  // Fetch bookmakers
  const { data: bookmakers, isLoading: isLoadingBookmakers } = useQuery({
    queryKey: ['/api/bookmakers'],
  });

  // Fetch tournament margins
  const { data: tournamentMargins, isLoading: isLoadingMargins } = useQuery({
    queryKey: ['/api/tournament-margins'],
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to load tournament margins data',
        variant: 'destructive',
      });
    },
  });

  // Group margins by country 
  const marginsByCountry = useMemo(() => {
    if (!tournamentMargins) return {};
    
    const result: Record<string, TournamentMargins[]> = {};
    
    tournamentMargins.forEach((margin: TournamentMargins) => {
      if (!result[margin.country]) {
        result[margin.country] = [];
      }
      
      result[margin.country].push(margin);
    });
    
    return result;
  }, [tournamentMargins]);

  // Initialize expanded state for all countries
  useEffect(() => {
    if (marginsByCountry && Object.keys(marginsByCountry).length > 0) {
      const initialExpandedState: Record<string, boolean> = {};
      Object.keys(marginsByCountry).forEach(country => {
        initialExpandedState[country] = true; // Start expanded
      });
      setExpandedCountries(initialExpandedState);
    }
  }, [marginsByCountry]);

  // Determine countries with significant margin differences
  const countriesWithMarginWarning = useMemo(() => {
    if (!tournamentMargins) return new Set<string>();
    
    const warningCountries = new Set<string>();
    
    tournamentMargins.forEach((margin: TournamentMargins) => {
      if (hasSignificantMarginDifference(margin.margins)) {
        warningCountries.add(margin.country);
      }
    });
    
    return warningCountries;
  }, [tournamentMargins]);

  // Toggle a country's expanded state
  const toggleCountry = (country: string) => {
    setExpandedCountries(prev => ({
      ...prev,
      [country]: !prev[country]
    }));
  };

  return (
    <Layout>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Tournament Margins
          </h1>
        </div>

        {isLoadingBookmakers || isLoadingMargins ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex justify-between items-center">
                <span>Tournament Margins by Country</span>
                <div className="flex items-center text-sm font-normal">
                  <Badge variant="outline" className="mr-2 bg-gray-100 dark:bg-gray-800">
                    Margins: (1/home + 1/draw + 1/away) - 1
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {Object.keys(marginsByCountry).length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No tournament margin data available
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-220px)]">
                  <div className="space-y-2">
                    {Object.entries(marginsByCountry).map(([country, margins]) => (
                      <Collapsible 
                        key={country} 
                        open={expandedCountries[country]} 
                        className="border rounded-md mb-2"
                      >
                        <CollapsibleTrigger
                          onClick={() => toggleCountry(country)}
                          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-t-md"
                        >
                          <div className="flex items-center">
                            <CountryFlag country={country} className="mr-2 w-6 h-4" />
                            <span className="font-medium">{country}</span>
                            {countriesWithMarginWarning.has(country) && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Triangle className="h-4 w-4 text-red-500 ml-2 fill-red-500" />
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  <p className="text-xs max-w-xs">
                                    Warning: BetPawa KE or GH margin is 2.5% or more higher/lower than other bookmakers
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="text-gray-500">
                            {expandedCountries[country] ? '▼' : '▶'} {margins.length} tournaments
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-2 pb-2">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-60 font-medium">Tournament</TableHead>
                                  {bookmakers?.map((bookmaker: any) => (
                                    <TableHead key={bookmaker.name} className="text-center font-medium">
                                      {bookmaker.displayName}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {margins.map((margin) => (
                                  <TableRow key={margin.id}>
                                    <TableCell className="font-medium align-middle">
                                      <div className="flex items-center">
                                        <span>{margin.tournament}</span>
                                        {hasSignificantMarginDifference(margin.margins) && (
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <Triangle className="h-4 w-4 text-red-500 ml-2 fill-red-500" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                              <p className="text-xs max-w-xs">
                                                Significant margin difference of 2.5% or more between BetPawa and other bookmakers
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                    </TableCell>
                                    {bookmakers?.map((bookmaker: any) => {
                                      const bookmakerMargin = margin.margins[bookmaker.name];
                                      const isOldData = bookmakerMargin && isOld(bookmakerMargin.timestamp);
                                      
                                      return (
                                        <TableCell 
                                          key={`${margin.id}-${bookmaker.name}`} 
                                          className={`text-center ${getMarginColorClass(bookmakerMargin?.value)}`}
                                        >
                                          {bookmakerMargin ? (
                                            <div className="inline-flex items-center">
                                              <span className="font-medium">{formatMargin(bookmakerMargin.value)}</span>
                                              
                                              {isOldData && (
                                                <Tooltip>
                                                  <TooltipTrigger>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                    <p className="text-xs">
                                                      Last updated: {format(new Date(bookmakerMargin.timestamp), 'MMM dd, yyyy HH:mm')}
                                                    </p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-gray-400">-</span>
                                          )}
                                        </TableCell>
                                      );
                                    })}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default TournamentMargins;