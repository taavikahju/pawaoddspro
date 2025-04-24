import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { cn } from '@/lib/utils';
import { Clock, Globe, Trophy } from 'lucide-react';

interface OddsTableProps {
  events: any[];
  isLoading: boolean;
  className?: string;
}

export default function OddsTable({ events, isLoading, className }: OddsTableProps) {
  const { bookmakers, selectedBookmakers } = useBookmakerContext();
  
  const filteredBookmakers = bookmakers.filter(b => selectedBookmakers.includes(b.code));
  
  // Helper function to determine if odds should be highlighted
  const getOddsHighlightType = (event: any, market: string, bookmakerCode: string): 'highest' | 'lowest' | 'none' => {
    if (!event.oddsData || !event.oddsData[bookmakerCode] || !event.oddsData[bookmakerCode][market]) {
      return 'none';
    }
    
    const currentOdd = event.oddsData[bookmakerCode][market];
    
    // Get all available odds for this market
    const allOdds: {code: string, value: number}[] = [];
    for (const code of Object.keys(event.oddsData)) {
      if (event.oddsData[code][market]) {
        allOdds.push({
          code,
          value: event.oddsData[code][market]
        });
      }
    }
    
    if (allOdds.length === 0) return 'none';
    
    // Find the highest and lowest values
    const highestOdd = Math.max(...allOdds.map(odd => odd.value));
    const lowestOdd = Math.min(...allOdds.map(odd => odd.value));
    
    // Count how many bookmakers have the highest value
    const bookiesWithHighest = allOdds.filter(odd => odd.value === highestOdd).map(odd => odd.code);
    
    // Count how many bookmakers have the lowest value
    const bookiesWithLowest = allOdds.filter(odd => odd.value === lowestOdd).map(odd => odd.code);
    
    // Check if this is the highest
    if (currentOdd === highestOdd) {
      // Special case: if exactly 2 bookmakers have the same highest value and they are both betPawa variants
      if (bookiesWithHighest.length === 2 && 
          bookiesWithHighest.includes('betPawa GH') && 
          bookiesWithHighest.includes('betPawa KE')) {
        return 'highest';
      }
      
      // If only 1 bookmaker has the highest value, highlight it
      if (bookiesWithHighest.length === 1) {
        return 'highest';
      }
    }
    
    // Check if this is the lowest
    if (currentOdd === lowestOdd) {
      // Special case: if exactly 2 bookmakers have the same lowest value and they are both betPawa variants
      if (bookiesWithLowest.length === 2 && 
          bookiesWithLowest.includes('betPawa GH') && 
          bookiesWithLowest.includes('betPawa KE')) {
        return 'lowest';
      }
      
      // If only 1 bookmaker has the lowest value, highlight it
      if (bookiesWithLowest.length === 1) {
        return 'lowest';
      }
    }
    
    return 'none';
  };
  
  // Calculate margin for a bookmaker's odds
  const calculateMargin = (homeOdds?: number, drawOdds?: number, awayOdds?: number): number | null => {
    if (!homeOdds || !drawOdds || !awayOdds) return null;
    
    try {
      const margin = (1 / homeOdds) + (1 / drawOdds) + (1 / awayOdds);
      return margin;
    } catch (error) {
      return null;
    }
  };
  
  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (events.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <p className="text-gray-500 dark:text-gray-400">No events found</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto bg-white dark:bg-slate-800 rounded-b-lg shadow", className)}>
      <Table className="w-full border-collapse">
        <TableHeader className="bg-gray-100 dark:bg-slate-700/50">
          <TableRow className="border-b border-gray-200 dark:border-gray-700">
            <TableHead className="w-24 px-2 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              <div className="flex items-center">
                <Globe className="w-3 h-3 mr-1" />
                Country
              </div>
            </TableHead>
            <TableHead className="w-28 px-2 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              <div className="flex items-center">
                <Trophy className="w-3 h-3 mr-1" />
                Tournament
              </div>
            </TableHead>
            <TableHead className="w-24 px-2 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              <div className="flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Start (UTC)
              </div>
            </TableHead>
            <TableHead className="w-48 px-2 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Fixture
            </TableHead>
            <TableHead className="w-20 px-2 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Market
            </TableHead>
            <TableHead className="w-20 px-2 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Source
            </TableHead>
            <TableHead className="w-16 px-2 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Home
            </TableHead>
            <TableHead className="w-16 px-2 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Draw
            </TableHead>
            <TableHead className="w-16 px-2 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Away
            </TableHead>
            <TableHead className="w-20 px-2 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Margin
            </TableHead>
          </TableRow>
        </TableHeader>
        
        <TableBody>
          {events.map((event, eventIndex) => (
            <React.Fragment key={eventIndex}>
              {filteredBookmakers.map((bookmaker, bookmakerIndex) => {
                const isFirstBookmaker = bookmakerIndex === 0;
                const isLastBookmaker = bookmakerIndex === filteredBookmakers.length - 1;
                // Use alternating background colors for events
                const isEvenEvent = eventIndex % 2 === 0;
                // If this is the last bookmaker for an event, add a thicker bottom border
                const bottomBorderClass = isLastBookmaker ? 'border-b-2 border-gray-300 dark:border-gray-600' : 'border-b border-gray-200 dark:border-gray-700';
                
                return (
                  <TableRow 
                    key={`${eventIndex}-${bookmakerIndex}`} 
                    className={`hover:bg-gray-100 dark:hover:bg-slate-700/40 ${bottomBorderClass}
                      ${isEvenEvent ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-800/60'}`}
                  >
                    {isFirstBookmaker && (
                      <>
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            {event.country || event.league?.split(' ')[0] || 'Unknown'}
                          </span>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            {(() => {
                              // First check if we have tournament data directly
                              if (event.tournament) {
                                return event.tournament;
                              }
                              
                              // Fallback to legacy format where league contains both country and tournament
                              if (event.league?.includes(' ')) {
                                const parts = event.league.split(' ');
                                // Return everything except the first part (country)
                                return parts.slice(1).join(' ');
                              }
                              
                              // Otherwise, return the league as is (might be just the tournament name)
                              return event.league || 'Unknown';
                            })()}
                          </span>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{event.date}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{event.time}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {event.teams}
                          </span>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            Match Result
                          </span>
                        </TableCell>
                      </>
                    )}
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {bookmaker.code}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-700">
                      <span 
                        className={cn(
                          "text-sm font-medium px-1 py-0.5 rounded",
                          getOddsHighlightType(event, 'home', bookmaker.code) === 'highest' 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" 
                            : getOddsHighlightType(event, 'home', bookmaker.code) === 'lowest'
                              ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                              : "bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        )}
                      >
                        {event.oddsData?.[bookmaker.code]?.home?.toFixed(2) || '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-700">
                      <span 
                        className={cn(
                          "text-sm font-medium px-1 py-0.5 rounded",
                          getOddsHighlightType(event, 'draw', bookmaker.code) === 'highest' 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" 
                            : getOddsHighlightType(event, 'draw', bookmaker.code) === 'lowest'
                              ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                              : "bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        )}
                      >
                        {event.oddsData?.[bookmaker.code]?.draw?.toFixed(2) || '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-700">
                      <span 
                        className={cn(
                          "text-sm font-medium px-1 py-0.5 rounded",
                          getOddsHighlightType(event, 'away', bookmaker.code) === 'highest' 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" 
                            : getOddsHighlightType(event, 'away', bookmaker.code) === 'lowest'
                              ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                              : "bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        )}
                      >
                        {event.oddsData?.[bookmaker.code]?.away?.toFixed(2) || '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center">
                      {(() => {
                        const homeOdds = event.oddsData?.[bookmaker.code]?.home;
                        const drawOdds = event.oddsData?.[bookmaker.code]?.draw;
                        const awayOdds = event.oddsData?.[bookmaker.code]?.away;
                        const margin = calculateMargin(homeOdds, drawOdds, awayOdds);
                        
                        const marginPercentage = margin ? ((margin - 1) * 100).toFixed(1) : '-';
                        
                        return (
                          <span className="text-sm font-medium px-1 py-0.5 rounded bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                            {marginPercentage !== '-' ? `${marginPercentage}%` : '-'}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}