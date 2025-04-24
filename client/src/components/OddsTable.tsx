import React, { useState } from 'react';
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
import { Trophy } from 'lucide-react';

interface OddsTableProps {
  events: any[];
  isLoading: boolean;
  className?: string;
}

export default function OddsTable({ events, isLoading, className }: OddsTableProps) {
  const { bookmakers, selectedBookmakers } = useBookmakerContext();
  const [selectedMarket, setSelectedMarket] = useState('all');
  
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
  
  // Get bookmaker logo or icon
  const getBookmakerLogo = (bookmakerCode: string) => {
    const logoMap: Record<string, JSX.Element> = {
      'bet365': <span className="bookmaker-logo text-blue-600 dark:text-blue-400 font-bold">B365</span>,
      'williamhill': <span className="bookmaker-logo text-green-600 dark:text-green-400 font-bold">WH</span>,
      'betfair': <span className="bookmaker-logo text-orange-600 dark:text-orange-400 font-bold">BF</span>,
      'paddypower': <span className="bookmaker-logo text-red-600 dark:text-red-400 font-bold">PP</span>,
    };
    
    return logoMap[bookmakerCode] || '';
  };
  
  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (events.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <p className="text-gray-500 dark:text-gray-400">No events found</p>
      </div>
    );
  }
  
  return (
    <div className={cn("overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow", className)}>
      <Table>
        <TableHeader className="bg-gray-100 dark:bg-slate-700/50">
          <TableRow>
            <TableHead className="sticky top-0 w-64 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Event
            </TableHead>
            <TableHead className="sticky top-0 w-32 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Time
            </TableHead>
            
            {filteredBookmakers.map((bookmaker) => (
              <TableHead 
                key={bookmaker.id}
                className={cn(
                  "sticky top-0 px-3 py-3 text-center text-xs font-medium uppercase tracking-wider",
                  `bg-${bookmaker.code}`,
                  bookmaker.code === 'bet365' ? 'text-blue-700 dark:text-blue-300' : '',
                  bookmaker.code === 'williamhill' ? 'text-green-700 dark:text-green-300' : '',
                  bookmaker.code === 'betfair' ? 'text-orange-700 dark:text-orange-300' : '',
                  bookmaker.code === 'paddypower' ? 'text-red-700 dark:text-red-300' : ''
                )}
              >
                <div className="bookmaker-header">
                  {getBookmakerLogo(bookmaker.code)}
                  {bookmaker.name}
                </div>
              </TableHead>
            ))}
            
            <TableHead className="sticky top-0 px-3 py-3 text-center text-xs font-medium bg-green-50 text-green-700 uppercase tracking-wider dark:bg-green-900/20 dark:text-green-300">
              <div className="bookmaker-header">
                <Trophy className="bookmaker-logo" />
                Best Odds
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b">
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col">
                  <div className="text-sm font-medium text-gray-900 dark:text-white mb-1 flex items-center">
                    <span className="inline-block w-4 h-4 bg-primary/10 rounded-full mr-2"></span>
                    {event.teams}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center ml-6">
                    <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                      {event.league}
                    </span>
                  </div>
                </div>
              </TableCell>
              
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col">
                  <div className="text-sm text-gray-900 dark:text-white font-medium">{event.date}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded inline-block">
                    {event.time}
                  </div>
                </div>
              </TableCell>
              
              {filteredBookmakers.map((bookmaker) => (
                <TableCell 
                  key={`${event.id}-${bookmaker.code}`}
                  className={cn(
                    "px-3 py-3 whitespace-nowrap text-center",
                    `bg-${bookmaker.code}`
                  )}
                >
                  <div className="space-x-2 text-sm">
                    <span 
                      className={cn(
                        "odds-cell bg-white dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600",
                        isBestOdd(event, 'home', bookmaker.code) && "odd-highlight"
                      )}
                      title="Home win"
                    >
                      <span className="odds-value">
                        {event.oddsData?.[bookmaker.code]?.home?.toFixed(2) || '-'}
                      </span>
                    </span>
                    
                    {event.oddsData?.[bookmaker.code]?.draw !== undefined && (
                      <span 
                        className={cn(
                          "odds-cell bg-white dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600",
                          isBestOdd(event, 'draw', bookmaker.code) && "odd-highlight"
                        )}
                        title="Draw"
                      >
                        <span className="odds-value">
                          {event.oddsData?.[bookmaker.code]?.draw?.toFixed(2) || '-'}
                        </span>
                      </span>
                    )}
                    
                    <span 
                      className={cn(
                        "odds-cell bg-white dark:bg-slate-700 text-gray-900 dark:text-white border-gray-200 dark:border-slate-600",
                        isBestOdd(event, 'away', bookmaker.code) && "odd-highlight"
                      )}
                      title="Away win"
                    >
                      <span className="odds-value">
                        {event.oddsData?.[bookmaker.code]?.away?.toFixed(2) || '-'}
                      </span>
                    </span>
                  </div>
                </TableCell>
              ))}
              
              <TableCell className="px-3 py-3 whitespace-nowrap text-center bg-green-50 dark:bg-green-900/10">
                <div className="space-x-2 text-sm">
                  <span className="odds-cell font-medium text-green-800 bg-green-100 border-green-200 dark:text-green-200 dark:bg-green-900/40 dark:border-green-900/50">
                    <span className="odds-value">
                      {event.bestOdds?.home?.toFixed(2) || '-'}
                    </span>
                  </span>
                  
                  {event.bestOdds?.draw !== undefined && (
                    <span className="odds-cell font-medium text-green-800 bg-green-100 border-green-200 dark:text-green-200 dark:bg-green-900/40 dark:border-green-900/50">
                      <span className="odds-value">
                        {event.bestOdds?.draw?.toFixed(2) || '-'}
                      </span>
                    </span>
                  )}
                  
                  <span className="odds-cell font-medium text-green-800 bg-green-100 border-green-200 dark:text-green-200 dark:bg-green-900/40 dark:border-green-900/50">
                    <span className="odds-value">
                      {event.bestOdds?.away?.toFixed(2) || '-'}
                    </span>
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
