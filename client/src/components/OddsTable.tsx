import React, { useMemo, useState } from 'react';
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
import { ArrowDownIcon, ArrowUpIcon, Clock, Globe, Trophy } from 'lucide-react';
import MarginHistoryPopup from './MarginHistoryPopup';
import OddsHistoryPopup from './OddsHistoryPopup';

interface OddsTableProps {
  events: any[];
  isLoading: boolean;
  className?: string;
}

export default function OddsTable({ events, isLoading, className }: OddsTableProps) {
  const { bookmakers, selectedBookmakers } = useBookmakerContext();
  const [selectedEvent, setSelectedEvent] = useState<{
    eventId: string;
    eventName: string;
    isOpen: boolean;
  }>({ eventId: '', eventName: '', isOpen: false });
  
  // State for odds history popup
  const [oddsHistoryPopup, setOddsHistoryPopup] = useState<{
    eventId: string;
    eventName: string;
    oddsType: 'home' | 'draw' | 'away';
    isOpen: boolean;
  }>({ eventId: '', eventName: '', oddsType: 'home', isOpen: false });
  
  const filteredBookmakers = bookmakers.filter(b => selectedBookmakers.includes(b.code));
  
  // Always show the comparison column if betPawa is selected along with either Sportybet or Betika KE
  const hasBetPawaGH = selectedBookmakers.includes('bp GH');
  const hasBetPawaKE = selectedBookmakers.includes('bp KE');
  const hasSportybet = selectedBookmakers.includes('sporty');
  const hasBetikaKE = selectedBookmakers.includes('betika KE');
  
  // Ghana filter active if betPawa GH and Sportybet are selected
  const isGhanaFilterActive = hasBetPawaGH && hasSportybet;
  
  // Kenya filter active if betPawa KE and Betika KE are selected
  const isKenyaFilterActive = hasBetPawaKE && hasBetikaKE;
  
  // Show the comparison column only if we have a specific Ghana or Kenya filter active
  // Specifically dont show for "All Bookmakers" filter
  const isComparisonAvailable = (isGhanaFilterActive || isKenyaFilterActive) && !(selectedBookmakers.length >= 4);
  
  console.log('Selected Bookmakers:', selectedBookmakers);
  console.log('betPawa GH present:', hasBetPawaGH, 'Sportybet present:', hasSportybet);
  console.log('betPawa KE present:', hasBetPawaKE, 'Betika KE present:', hasBetikaKE);
  console.log('Ghana filter active:', isGhanaFilterActive);
  console.log('Kenya filter active:', isKenyaFilterActive);
  console.log('Comparison available:', isComparisonAvailable);
  
  // Helper function to determine if odds should be highlighted
  const getOddsHighlightType = (event: any, market: string, bookmakerCode: string): 'highest' | 'lowest' | 'none' => {
    if (!event.oddsData || !event.oddsData[bookmakerCode] || !event.oddsData[bookmakerCode][market]) {
      return 'none';
    }
    
    const currentOdd = event.oddsData[bookmakerCode][market];
    
    // Get all available odds ONLY FROM SELECTED BOOKMAKERS for this market
    const allOdds: {code: string, value: number}[] = [];
    for (const bookie of filteredBookmakers) {
      const code = bookie.code;
      if (event.oddsData[code] && event.oddsData[code][market]) {
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
          bookiesWithHighest.includes('bp GH') && 
          bookiesWithHighest.includes('bp KE')) {
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
          bookiesWithLowest.includes('bp GH') && 
          bookiesWithLowest.includes('bp KE')) {
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
  
  // Calculate the favorite price comparison for betPawa vs competitor
  const calculateFavoriteComparison = (event: any): { comparison: number | null, isBetter: boolean | null, favorite: 'home' | 'draw' | 'away' | null } => {
    if (!event.oddsData) return { comparison: null, isBetter: null, favorite: null };
    
    // Get the appropriate betPawa code based on the active filter
    const betPawaCode = isGhanaFilterActive ? 'bp GH' : isKenyaFilterActive ? 'bp KE' : null;
    
    // Get the appropriate competitor code based on the active filter
    const competitorCode = isGhanaFilterActive ? 'sporty' : isKenyaFilterActive ? 'betika KE' : null;
    console.log('Selected betPawa code:', betPawaCode, 'Selected competitor code:', competitorCode);
    
    if (!betPawaCode || !competitorCode) return { comparison: null, isBetter: null, favorite: null };
    
    const betPawaOdds = event.oddsData[betPawaCode];
    const competitorOdds = event.oddsData[competitorCode];
    
    if (!betPawaOdds || !competitorOdds) return { comparison: null, isBetter: null, favorite: null };
    
    // Find the lowest odds for betPawa (the favorite)
    const betPawaHome = betPawaOdds.home || Number.MAX_VALUE;
    const betPawaDraw = betPawaOdds.draw || Number.MAX_VALUE;
    const betPawaAway = betPawaOdds.away || Number.MAX_VALUE;
    
    // Find the lowest odds for the competitor
    const competitorHome = competitorOdds.home || Number.MAX_VALUE;
    const competitorDraw = competitorOdds.draw || Number.MAX_VALUE;
    const competitorAway = competitorOdds.away || Number.MAX_VALUE;
    
    // Determine the favorite selection for betPawa
    let favorite: 'home' | 'draw' | 'away' | null = null;
    let betPawaFavoritePrice = Number.MAX_VALUE;
    
    if (betPawaHome < betPawaDraw && betPawaHome < betPawaAway) {
      favorite = 'home';
      betPawaFavoritePrice = betPawaHome;
    } else if (betPawaDraw < betPawaHome && betPawaDraw < betPawaAway) {
      favorite = 'draw';
      betPawaFavoritePrice = betPawaDraw;
    } else if (betPawaAway < betPawaHome && betPawaAway < betPawaDraw) {
      favorite = 'away';
      betPawaFavoritePrice = betPawaAway;
    } else {
      // If there are ties, we'll prioritize in this order: home, draw, away
      if (betPawaHome <= betPawaDraw && betPawaHome <= betPawaAway) {
        favorite = 'home';
        betPawaFavoritePrice = betPawaHome;
      } else if (betPawaDraw <= betPawaHome && betPawaDraw <= betPawaAway) {
        favorite = 'draw';
        betPawaFavoritePrice = betPawaDraw;
      } else {
        favorite = 'away';
        betPawaFavoritePrice = betPawaAway;
      }
    }
    
    // If we couldn't determine a favorite or the price
    if (!favorite || betPawaFavoritePrice === Number.MAX_VALUE) {
      return { comparison: null, isBetter: null, favorite: null };
    }
    
    // Get the same selection's price from the competitor
    let competitorPrice = Number.MAX_VALUE;
    if (favorite === 'home') competitorPrice = competitorHome;
    else if (favorite === 'draw') competitorPrice = competitorDraw;
    else if (favorite === 'away') competitorPrice = competitorAway;
    
    if (competitorPrice === Number.MAX_VALUE) {
      return { comparison: null, isBetter: null, favorite };
    }
    
    // Calculate the percentage difference
    // (betPawa / competitor - 1) * 100
    const comparison = ((betPawaFavoritePrice / competitorPrice) - 1) * 100;
    const isBetter = comparison > 0; // Better if betPawa offers higher odds
    
    return { comparison, isBetter, favorite };
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
    <div className={cn("overflow-x-auto bg-[#1e2a3b] rounded-b-lg shadow", className)}>
      <Table className="w-full border-collapse">
        <TableHeader className="bg-[#101824]">
          <TableRow className="border-b border-[#2e3a4a]">
            <TableHead className="w-24 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              <div className="flex items-center justify-center">
                <Globe className="w-3 h-3 mr-1" />
                Country
              </div>
            </TableHead>
            <TableHead className="w-28 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              <div className="flex items-center justify-center">
                <Trophy className="w-3 h-3 mr-1" />
                Tournament
              </div>
            </TableHead>
            <TableHead className="w-24 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              <div className="flex items-center justify-center">
                <Clock className="w-3 h-3 mr-1" />
                Start
              </div>
            </TableHead>
            <TableHead className="w-48 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              Fixture
            </TableHead>
            <TableHead className="w-20 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              Market
            </TableHead>
            <TableHead className="w-20 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              Source
            </TableHead>
            <TableHead className="w-16 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              Home
            </TableHead>
            <TableHead className="w-16 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              Draw
            </TableHead>
            <TableHead className="w-16 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              Away
            </TableHead>
            <TableHead className="w-20 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              Margin
            </TableHead>
            {isComparisonAvailable && (
              <TableHead className="w-20 px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                Fav. Odds Δ%
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        
        <TableBody>
          {events.map((event, eventIndex) => (
            <div key={`event-group-${eventIndex}`}>
              {filteredBookmakers.map((bookmaker, bookmakerIndex) => {
                const isFirstBookmaker = bookmakerIndex === 0;
                const isLastBookmaker = bookmakerIndex === filteredBookmakers.length - 1;
                // Use alternating background colors for events
                const isEvenEvent = eventIndex % 2 === 0;
                // If this is the last bookmaker for an event, add a thicker bottom border
                const bottomBorderClass = isLastBookmaker ? 'border-b-2 border-[#2e3a4a]' : 'border-b border-[#2e3a4a]';
                
                return (
                  <TableRow 
                    key={`${eventIndex}-${bookmakerIndex}`} 
                    className={`hover:bg-[#283648] ${bottomBorderClass}
                      ${isEvenEvent ? 'bg-[#1e2a3b]' : 'bg-[#1a2535]'}`}
                  >
                    {isFirstBookmaker && (
                      <>
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-[#2e3a4a] text-center" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-sm text-gray-300">
                            {event.country || event.league?.split(' ')[0] || 'Unknown'}
                          </span>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-[#2e3a4a] text-center" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-sm text-gray-300">
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
                          className="px-2 py-1 whitespace-nowrap border-r border-[#2e3a4a] text-center" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-medium text-gray-200">{event.date}</span>
                            <span className="text-sm text-gray-400">{event.time}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-[#2e3a4a] text-center" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-sm font-medium text-gray-200">
                            {event.teams}
                          </span>
                        </TableCell>
                        
                        <TableCell 
                          className="px-2 py-1 whitespace-nowrap border-r border-[#2e3a4a] text-center" 
                          rowSpan={filteredBookmakers.length}
                        >
                          <span className="text-sm text-gray-300">
                            Match Result
                          </span>
                        </TableCell>
                      </>
                    )}
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap border-r border-[#2e3a4a] text-center">
                      <span className="text-sm font-medium text-gray-300">
                        {bookmaker.code}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-[#2e3a4a]">
                      <span 
                        className={cn(
                          "text-sm font-medium px-1 py-0.5 rounded",
                          getOddsHighlightType(event, 'home', bookmaker.code) === 'highest' 
                            ? "bg-green-800/20 text-green-300" 
                            : getOddsHighlightType(event, 'home', bookmaker.code) === 'lowest'
                              ? "bg-red-800/20 text-red-300"
                              : "bg-[#1e2a3b] text-gray-300"
                        )}
                      >
                        {event.oddsData?.[bookmaker.code]?.home ? (
                          <button 
                            className="hover:underline focus:outline-none"
                            onClick={() => setOddsHistoryPopup({
                              eventId: event.eventId,
                              eventName: event.fixture,
                              oddsType: 'home',
                              isOpen: true
                            })}
                          >
                            {event.oddsData[bookmaker.code].home.toFixed(2)}
                          </button>
                        ) : '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-[#2e3a4a]">
                      <span 
                        className={cn(
                          "text-sm font-medium px-1 py-0.5 rounded",
                          getOddsHighlightType(event, 'draw', bookmaker.code) === 'highest' 
                            ? "bg-green-800/20 text-green-300" 
                            : getOddsHighlightType(event, 'draw', bookmaker.code) === 'lowest'
                              ? "bg-red-800/20 text-red-300"
                              : "bg-[#1e2a3b] text-gray-300"
                        )}
                      >
                        {event.oddsData?.[bookmaker.code]?.draw ? (
                          <button 
                            className="hover:underline focus:outline-none"
                            onClick={() => setOddsHistoryPopup({
                              eventId: event.eventId,
                              eventName: event.fixture,
                              oddsType: 'draw',
                              isOpen: true
                            })}
                          >
                            {event.oddsData[bookmaker.code].draw.toFixed(2)}
                          </button>
                        ) : '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-[#2e3a4a]">
                      <span 
                        className={cn(
                          "text-sm font-medium px-1 py-0.5 rounded",
                          getOddsHighlightType(event, 'away', bookmaker.code) === 'highest' 
                            ? "bg-green-800/20 text-green-300" 
                            : getOddsHighlightType(event, 'away', bookmaker.code) === 'lowest'
                              ? "bg-red-800/20 text-red-300"
                              : "bg-[#1e2a3b] text-gray-300"
                        )}
                      >
                        {event.oddsData?.[bookmaker.code]?.away ? (
                          <button 
                            className="hover:underline focus:outline-none"
                            onClick={() => setOddsHistoryPopup({
                              eventId: event.eventId,
                              eventName: event.fixture,
                              oddsType: 'away',
                              isOpen: true
                            })}
                          >
                            {event.oddsData[bookmaker.code].away.toFixed(2)}
                          </button>
                        ) : '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-[#2e3a4a]">
                      {(() => {
                        const homeOdds = event.oddsData?.[bookmaker.code]?.home;
                        const drawOdds = event.oddsData?.[bookmaker.code]?.draw;
                        const awayOdds = event.oddsData?.[bookmaker.code]?.away;
                        const margin = calculateMargin(homeOdds, drawOdds, awayOdds);
                        
                        const marginPercentage = margin ? ((margin - 1) * 100).toFixed(2) : '-';
                        
                        // Determine margin color based on value
                        let marginColorClass = 'text-gray-300';
                        if (marginPercentage !== '-') {
                          const marginValue = parseFloat(marginPercentage);
                          if (marginValue < 5) {
                            marginColorClass = 'text-green-300';
                          } else if (marginValue < 7.5) {
                            marginColorClass = 'text-lime-300';
                          } else if (marginValue < 10) {
                            marginColorClass = 'text-amber-300';
                          } else if (marginValue < 12.5) {
                            marginColorClass = 'text-orange-300';
                          } else {
                            marginColorClass = 'text-red-300';
                          }
                        }
                        
                        // Add clickable functionality if margin is available
                        if (marginPercentage !== '-' && event.eventId) {
                          return (
                            <button 
                              onClick={() => setSelectedEvent({
                                eventId: event.eventId,
                                eventName: event.teams,
                                isOpen: true
                              })}
                              className={`text-sm font-medium px-2 py-1 rounded bg-[#283648] hover:bg-[#324254] ${marginColorClass} cursor-pointer transition-colors duration-150 ease-in-out`}
                            >
                              {marginPercentage}%
                            </button>
                          );
                        }
                        
                        return (
                          <span className="text-sm font-medium px-1 py-0.5 rounded bg-[#283648] text-gray-300">
                            {marginPercentage !== '-' ? `${marginPercentage}%` : '-'}
                          </span>
                        );
                      })()}
                    </TableCell>
                    
                    {isComparisonAvailable && (
                      <TableCell 
                        className="px-2 py-1 whitespace-nowrap text-center" 
                        rowSpan={filteredBookmakers.length}
                        style={{ display: isFirstBookmaker ? 'table-cell' : 'none' }}
                      >
                        {(() => {
                          // Calculation happens in first row only
                          const { comparison, isBetter, favorite } = calculateFavoriteComparison(event);
                          
                          if (comparison === null) {
                            return (
                              <span className="text-sm font-medium px-1 py-0.5 rounded bg-[#283648] text-gray-300">
                                -
                              </span>
                            );
                          }
                          
                          // Format the comparison percentage with sign and 2 decimal places
                          const formattedComparison = comparison.toFixed(2);
                          const displayValue = `${formattedComparison}%`;
                          
                          // Check if the comparison is effectively zero (accounting for floating point rounding)
                          const isEffectivelyZero = Math.abs(comparison) < 0.005;
                          
                          if (isEffectivelyZero) {
                            return (
                              <span className="text-sm font-medium px-1 py-0.5 rounded bg-[#283648] text-gray-300 flex items-center justify-center">
                                {displayValue}
                              </span>
                            );
                          }
                          
                          // No icon, just color coding
                          return (
                            <span className={cn(
                              "text-sm font-medium px-1 py-0.5 rounded flex items-center justify-center",
                              isBetter
                                ? "bg-green-800/20 text-green-300" 
                                : "bg-red-800/20 text-red-300"
                            )}>
                              {displayValue}
                            </span>
                          );
                        })()}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </div>
          ))}
        </TableBody>
      </Table>
      
      {/* Render the MarginHistoryPopup */}
      <MarginHistoryPopup
        isOpen={selectedEvent.isOpen}
        onClose={() => setSelectedEvent(prev => ({ ...prev, isOpen: false }))}
        eventId={selectedEvent.eventId}
        eventName={selectedEvent.eventName}
        bookmakers={selectedBookmakers}
      />
      
      {/* Render the OddsHistoryPopup */}
      <OddsHistoryPopup
        isOpen={oddsHistoryPopup.isOpen}
        onClose={() => setOddsHistoryPopup(prev => ({ ...prev, isOpen: false }))}
        eventId={oddsHistoryPopup.eventId}
        eventName={oddsHistoryPopup.eventName}
        bookmakers={selectedBookmakers}
        oddsType={oddsHistoryPopup.oddsType}
      />
    </div>
  );
}