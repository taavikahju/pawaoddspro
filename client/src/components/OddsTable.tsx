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
  
  // Function to determine if an odd is the best available
  const isBestOdd = (event: any, market: string, bookmakerCode: string) => {
    if (!event.oddsData || !event.oddsData[bookmakerCode] || !event.oddsData[bookmakerCode][market]) {
      return false;
    }
    
    const currentOdd = event.oddsData[bookmakerCode][market];
    const bestOdd = event.bestOdds && event.bestOdds[market];
    
    return currentOdd === bestOdd;
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
    <div className={cn("overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow", className)}>
      <Table className="w-full border-collapse">
        <TableHeader className="bg-gray-100 dark:bg-slate-700/50">
          <TableRow className="border-b border-gray-200 dark:border-gray-700">
            <TableHead className="sticky top-0 w-24 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              <div className="flex items-center">
                <Globe className="w-3 h-3 mr-1" />
                Country
              </div>
            </TableHead>
            <TableHead className="sticky top-0 w-28 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              <div className="flex items-center">
                <Trophy className="w-3 h-3 mr-1" />
                Tournament
              </div>
            </TableHead>
            <TableHead className="sticky top-0 w-24 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              <div className="flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Start (UTC)
              </div>
            </TableHead>
            <TableHead className="sticky top-0 w-48 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Fixture
            </TableHead>
            <TableHead className="sticky top-0 w-20 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Market
            </TableHead>
            <TableHead className="sticky top-0 w-20 px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Source
            </TableHead>
            <TableHead className="sticky top-0 w-16 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Home
            </TableHead>
            <TableHead className="sticky top-0 w-16 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Draw
            </TableHead>
            <TableHead className="sticky top-0 w-16 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Away
            </TableHead>
            <TableHead className="sticky top-0 w-20 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
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
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            {event.league?.split(' ')[0] || 'Unknown'}
                          </span>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            {event.league?.split(' ').slice(1).join(' ') || event.league || 'Unknown'}
                          </span>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{event.date}</span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">{event.time}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                            {event.teams}
                          </span>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            Match Result
                          </span>
                        </TableCell>
                      </>
                    )}
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap border-r border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {bookmaker.code}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-700">
                      <span 
                        className={cn(
                          "text-xs font-medium px-1 py-0.5 rounded",
                          isBestOdd(event, 'home', bookmaker.code) 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" 
                            : "bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        )}
                      >
                        {event.oddsData?.[bookmaker.code]?.home?.toFixed(2) || '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-700">
                      <span 
                        className={cn(
                          "text-xs font-medium px-1 py-0.5 rounded",
                          isBestOdd(event, 'draw', bookmaker.code) 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" 
                            : "bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        )}
                      >
                        {event.oddsData?.[bookmaker.code]?.draw?.toFixed(2) || '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-700">
                      <span 
                        className={cn(
                          "text-xs font-medium px-1 py-0.5 rounded",
                          isBestOdd(event, 'away', bookmaker.code) 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" 
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
                        
                        let colorClass = "text-gray-600 dark:text-gray-400";
                        if (margin) {
                          if (margin < 1.05) colorClass = "text-green-600 dark:text-green-400";
                          else if (margin >= 1.05 && margin < 1.1) colorClass = "text-yellow-600 dark:text-yellow-400";
                          else colorClass = "text-red-600 dark:text-red-400";
                        }
                        
                        return (
                          <span 
                            className={`text-xs font-medium px-1 py-0.5 rounded bg-gray-50 dark:bg-gray-800 ${colorClass}`}
                          >
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