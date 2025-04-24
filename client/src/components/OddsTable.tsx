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
  
  // Get bookmaker-specific background colors
  const getBookmakerBgColor = (bookmakerCode: string) => {
    const colorMap: Record<string, string> = {
      'bet365': 'bg-blue-50 dark:bg-blue-900/10',
      'williamhill': 'bg-green-50 dark:bg-green-900/10',
      'betfair': 'bg-orange-50 dark:bg-orange-900/10',
      'paddypower': 'bg-red-50 dark:bg-red-900/10',
    };
    
    return colorMap[bookmakerCode] || '';
  };
  
  // Get bookmaker-specific header background colors
  const getBookmakerHeaderBgColor = (bookmakerCode: string) => {
    const colorMap: Record<string, string> = {
      'bet365': 'bg-blue-50 dark:bg-blue-900/20 dark:text-blue-200',
      'williamhill': 'bg-green-50 dark:bg-green-900/20 dark:text-green-200',
      'betfair': 'bg-orange-50 dark:bg-orange-900/20 dark:text-orange-200',
      'paddypower': 'bg-red-50 dark:bg-red-900/20 dark:text-red-200',
    };
    
    return colorMap[bookmakerCode] || '';
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
      <div className="h-64 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">No events found</p>
      </div>
    );
  }
  
  return (
    <div className={cn("overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow-sm", className)}>
      <Table>
        <TableHeader className="bg-gray-50 dark:bg-slate-700">
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
                  "sticky top-0 px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider",
                  getBookmakerHeaderBgColor(bookmaker.code)
                )}
              >
                {bookmaker.name}
              </TableHead>
            ))}
            
            <TableHead className="sticky top-0 px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
              Best Odds
            </TableHead>
          </TableRow>
        </TableHeader>
        
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {event.teams}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {event.league}
                    </div>
                  </div>
                </div>
              </TableCell>
              
              <TableCell className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 dark:text-white">{event.date}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{event.time}</div>
              </TableCell>
              
              {filteredBookmakers.map((bookmaker) => (
                <TableCell 
                  key={`${event.id}-${bookmaker.code}`}
                  className={cn(
                    "px-3 py-4 whitespace-nowrap text-center",
                    getBookmakerBgColor(bookmaker.code)
                  )}
                >
                  <div className="space-x-2 text-sm">
                    <span 
                      className={cn(
                        "inline-block w-14 p-1.5 font-medium text-gray-900 dark:text-white bg-white rounded border border-gray-200 dark:bg-slate-700 dark:border-slate-600",
                        isBestOdd(event, 'home', bookmaker.code) && "odd-highlight"
                      )}
                    >
                      {event.oddsData?.[bookmaker.code]?.home?.toFixed(2) || '-'}
                    </span>
                    
                    {event.oddsData?.[bookmaker.code]?.draw !== undefined && (
                      <span 
                        className={cn(
                          "inline-block w-14 p-1.5 font-medium text-gray-900 dark:text-white bg-white rounded border border-gray-200 dark:bg-slate-700 dark:border-slate-600",
                          isBestOdd(event, 'draw', bookmaker.code) && "odd-highlight"
                        )}
                      >
                        {event.oddsData?.[bookmaker.code]?.draw?.toFixed(2) || '-'}
                      </span>
                    )}
                    
                    <span 
                      className={cn(
                        "inline-block w-14 p-1.5 font-medium text-gray-900 dark:text-white bg-white rounded border border-gray-200 dark:bg-slate-700 dark:border-slate-600",
                        isBestOdd(event, 'away', bookmaker.code) && "odd-highlight"
                      )}
                    >
                      {event.oddsData?.[bookmaker.code]?.away?.toFixed(2) || '-'}
                    </span>
                  </div>
                </TableCell>
              ))}
              
              <TableCell className="px-3 py-4 whitespace-nowrap text-center">
                <div className="space-x-2 text-sm">
                  <span className="inline-block w-14 p-1.5 font-medium text-green-800 bg-green-100 rounded border border-green-200 dark:text-green-200 dark:bg-green-900/40 dark:border-green-900">
                    {event.bestOdds?.home?.toFixed(2) || '-'}
                  </span>
                  
                  {event.bestOdds?.draw !== undefined && (
                    <span className="inline-block w-14 p-1.5 font-medium text-green-800 bg-green-100 rounded border border-green-200 dark:text-green-200 dark:bg-green-900/40 dark:border-green-900">
                      {event.bestOdds?.draw?.toFixed(2) || '-'}
                    </span>
                  )}
                  
                  <span className="inline-block w-14 p-1.5 font-medium text-green-800 bg-green-100 rounded border border-green-200 dark:text-green-200 dark:bg-green-900/40 dark:border-green-900">
                    {event.bestOdds?.away?.toFixed(2) || '-'}
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
