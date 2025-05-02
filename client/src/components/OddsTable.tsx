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
import CountryFlag from './CountryFlag';

interface OddsTableProps {
  events: any[];
  isLoading: boolean;
  className?: string;
}

export default function OddsTable({ events, isLoading, className }: OddsTableProps) {
  const { bookmakers, selectedBookmakers, isTop5LeaguesActive } = useBookmakerContext();
  
  // State for margin history popup
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
  
  // Sort bookmakers by ID for consistent order, then filter to selected ones
  const filteredBookmakers = [...bookmakers]
    .sort((a, b) => a.id - b.id)
    .filter(b => selectedBookmakers.includes(b.code));
  
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
  
  // Function to check if an event belongs to one of the Top 5 Leagues
  const isEventInTop5Leagues = (event: any): boolean => {
    // Specifically looking for:
    // 1. England Premier League
    // 2. France Ligue 1
    // 3. Germany Bundesliga (men's only, not Bundesliga 2)
    // 4. Italy Serie A (men's only, not women's)
    // 5. Spain La Liga (top division only, not La Liga 2)
    
    if (!event.country && !event.tournament) {
      // Try to extract from legacy league format
      if (event.league) {
        const leagueInfo = event.league.toLowerCase();
        
        // Exclude women's leagues and lower divisions
        if (leagueInfo.includes('women') || 
            leagueInfo.includes('2') || 
            leagueInfo.includes('b') || 
            leagueInfo.includes('segunda')) {
          return false;
        }
        
        return (
          (leagueInfo.includes('england') && leagueInfo.includes('premier league')) ||
          (leagueInfo.includes('spain') && (leagueInfo.includes('laliga') || leagueInfo.includes('la liga'))) ||
          (leagueInfo.includes('germany') && leagueInfo.includes('bundesliga')) ||
          (leagueInfo.includes('italy') && leagueInfo.includes('serie a')) ||
          (leagueInfo.includes('france') && leagueInfo.includes('ligue 1'))
        );
      }
      return false;
    }

    // If we have structured country and tournament data
    const country = (event.country || '').toLowerCase();
    const tournament = (event.tournament || '').toLowerCase();
    
    // Exclude women's leagues and lower divisions
    if (tournament.includes('women') || 
        tournament.includes('2') || 
        tournament.includes('b') || 
        tournament.includes('segunda')) {
      return false;
    }
    
    return (
      (country === 'england' && tournament.includes('premier league')) ||
      (country === 'spain' && (tournament.includes('laliga') || tournament.includes('la liga'))) ||
      (country === 'germany' && tournament.includes('bundesliga')) ||
      (country === 'italy' && tournament.includes('serie a')) ||
      (country === 'france' && tournament.includes('ligue 1'))
    );
  };

  // Filter events for Top 5 Leagues if that filter is active
  const filteredEvents = useMemo(() => {
    if (isTop5LeaguesActive) {
      return events.filter(isEventInTop5Leagues);
    }
    return events;
  }, [events, isTop5LeaguesActive]);

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
    if (code === 'XX' && countryName && countryName !== 'Unknown') {
      console.debug(`No country code found for: "${countryName}" (normalized: "${normalizedName}")`);
    }
    
    return code;
  };
  
  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (events.length === 0 || filteredEvents.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <p className="text-gray-500 dark:text-gray-400">
          {events.length === 0 ? "No events found" : 
           isTop5LeaguesActive ? "No Top 5 Leagues events found" : "No events found"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto bg-white dark:bg-slate-800 rounded-b-lg shadow", className)}>
      {isTop5LeaguesActive && (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-sm border-b border-gray-200 dark:border-gray-700">
          <span className="font-medium text-blue-700 dark:text-blue-400">
            Top 5 Leagues Filter: 
          </span>
          <span className="text-gray-700 dark:text-gray-300 ml-1">
            Showing {filteredEvents.length} events from England Premier League, Spain La Liga, Germany Bundesliga, Italy Serie A, and France Ligue 1
          </span>
        </div>
      )}
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
                Start
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
            {isComparisonAvailable && (
              <TableHead className="w-20 px-2 py-2 text-center text-sm font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                Fav. Odds Δ%
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        
        <TableBody>
          {filteredEvents.map((event, eventIndex) => (
            // Using a non-Fragment wrapper to avoid React.Fragment warnings with Replit metadata
            <tbody key={eventIndex} className="contents">
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
                          <div className="flex items-center gap-1.5">
                            {(() => {
                              const countryName = event.country || event.league?.split(' ')[0] || 'Unknown';
                              // Use the same function as in dashboard to get country code
                              const countryCode = getCountryCode(countryName);
                              return (
                                <div className="flex items-center gap-1.5">
                                  <CountryFlag
                                    countryCode={countryCode}
                                    countryName={countryName}
                                    size="sm"
                                  />
                                  <span className="text-sm text-gray-600 dark:text-gray-300">
                                    {countryName}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
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
                            {(event.oddsData[bookmaker.code]?.home || 0).toFixed(2)}
                          </button>
                        ) : '-'}
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
                            {(event.oddsData[bookmaker.code]?.draw || 0).toFixed(2)}
                          </button>
                        ) : '-'}
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
                            {(event.oddsData[bookmaker.code]?.away || 0).toFixed(2)}
                          </button>
                        ) : '-'}
                      </span>
                    </TableCell>
                    
                    <TableCell className="px-2 py-1 whitespace-nowrap text-center border-r border-gray-200 dark:border-gray-700">
                      {(() => {
                        const homeOdds = event.oddsData?.[bookmaker.code]?.home;
                        const drawOdds = event.oddsData?.[bookmaker.code]?.draw;
                        const awayOdds = event.oddsData?.[bookmaker.code]?.away;
                        const margin = calculateMargin(homeOdds, drawOdds, awayOdds);
                        
                        const marginPercentage = margin ? ((margin - 1) * 100).toFixed(2) : '-';
                        
                        // Determine margin color based on value
                        let marginColorClass = 'text-gray-800 dark:text-gray-300';
                        if (marginPercentage !== '-') {
                          const marginValue = parseFloat(marginPercentage);
                          if (marginValue < 5) {
                            marginColorClass = 'text-green-600';
                          } else if (marginValue < 7.5) {
                            marginColorClass = 'text-lime-600';
                          } else if (marginValue < 10) {
                            marginColorClass = 'text-amber-600';
                          } else if (marginValue < 12.5) {
                            marginColorClass = 'text-orange-600';
                          } else {
                            marginColorClass = 'text-red-600';
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
                              className={`text-sm font-medium px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 ${marginColorClass} cursor-pointer transition-colors duration-150 ease-in-out`}
                            >
                              {marginPercentage}%
                            </button>
                          );
                        }
                        
                        return (
                          <span className="text-sm font-medium px-1 py-0.5 rounded bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
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
                              <span className="text-sm font-medium px-1 py-0.5 rounded bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
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
                              <span className="text-sm font-medium px-1 py-0.5 rounded bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-gray-300 flex items-center justify-center">
                                {displayValue}
                              </span>
                            );
                          }
                          
                          // No icon, just color coding
                          return (
                            <span className={cn(
                              "text-sm font-medium px-1 py-0.5 rounded flex items-center justify-center",
                              isBetter
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300" 
                                : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
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
            </tbody>
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