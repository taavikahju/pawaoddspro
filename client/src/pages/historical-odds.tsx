import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, Filter, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { useToast } from '@/hooks/use-toast';
import CountryFlag from '../components/CountryFlag';
import HistoricalOddsChart from '../components/HistoricalOddsChart';

// Type for event data
interface Event {
  id: number;
  externalId: string;
  eventId: string;
  name: string;
  country: string;
  tournament: string;
  sportId: number;
  startTime: string;
  oddsData: Record<string, {
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    margin: number;
  }>;
}

// Type for history entry
interface OddsHistoryEntry {
  id: number;
  eventId: string;
  externalId: string;
  bookmakerCode: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  margin: number;
  timestamp: string;
}

export default function HistoricalOdds() {
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [tournamentFilter, setTournamentFilter] = useState<string>('all');
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [availableTournaments, setAvailableTournaments] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  
  const { selectedBookmakers } = useBookmakerContext();
  const { toast } = useToast();

  // Fetch past events
  const { 
    data: events = [],
    isLoading: isLoadingEvents,
    isError,
    error
  } = useQuery<Event[]>({ 
    queryKey: ['/api/events', 'past', countryFilter, tournamentFilter],
    queryFn: async () => {
      const params: Record<string, string> = { past_only: 'true' };
      
      // Add filters if not 'all'
      if (countryFilter !== 'all') params.country = countryFilter;
      if (tournamentFilter !== 'all') params.tournament = tournamentFilter;
      
      const response = await axios.get('/api/events', { params });
      return response.data;
    },
    refetchOnWindowFocus: false
  });

  // Fetch history data for selected event
  const { 
    data: historyData = [],
    isLoading: isLoadingHistory,
  } = useQuery<OddsHistoryEntry[]>({ 
    queryKey: ['/api/events', selectedEvent?.eventId, 'history'],
    queryFn: async () => {
      if (!selectedEvent?.eventId) return [];
      const response = await axios.get(`/api/events/${selectedEvent.eventId}/history`);
      return response.data;
    },
    enabled: !!selectedEvent && isDialogOpen, // Only fetch when dialog is open and event is selected
    refetchOnWindowFocus: false
  });

  // Extract available countries and tournaments from events data
  useEffect(() => {
    if (events.length > 0) {
      // Extract unique countries
      const countriesSet = new Set<string>();
      events.forEach(event => {
        if (event.country) countriesSet.add(event.country);
      });
      const countries = Array.from(countriesSet).sort();
      setAvailableCountries(countries);
      
      // Extract tournaments based on country filter
      const tournamentsSet = new Set<string>();
      events
        .filter(event => countryFilter === 'all' || event.country === countryFilter)
        .forEach(event => {
          if (event.tournament) tournamentsSet.add(event.tournament);
        });
      
      const tournaments = Array.from(tournamentsSet).sort();
      setAvailableTournaments(tournaments);
    }
  }, [events, countryFilter]);

  // Handle filter resets
  const resetFilters = () => {
    setCountryFilter('all');
    setTournamentFilter('all');
  };

  // Handle tournament change
  const handleTournamentChange = (value: string) => {
    setTournamentFilter(value);
  };

  // Open dialog with event data
  const openEventDialog = (event: Event) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  // Format date/time for display
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };
  
  // Render loading state
  if (isLoadingEvents) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading historical events...</span>
      </div>
    );
  }

  // Render error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="text-red-500 mb-4 text-lg">
          Error loading events: {(error as Error).message}
        </div>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  // Check if we have past events
  const hasPastEvents = events.length > 0;

  // Filter events by tournaments if tournament filter is set
  const filteredEvents = tournamentFilter !== 'all'
    ? events.filter(event => event.tournament === tournamentFilter)
    : events;

  return (
    <div className="container py-4 mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Historical Odds</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          View and analyze historical odds for past events
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </CardTitle>
            {(countryFilter !== 'all' || tournamentFilter !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFilters} 
                className="h-8 text-xs"
              >
                <X className="h-3 w-3 mr-1" /> Clear Filters
              </Button>
            )}
          </div>
          <CardDescription>Filter historical events by country and tournament</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Country</label>
              <Select 
                value={countryFilter} 
                onValueChange={setCountryFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {availableCountries.map(country => (
                    <SelectItem key={country} value={country}>
                      <div className="flex items-center">
                        <CountryFlag country={country} className="mr-2 h-3.5" />
                        {country}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tournament</label>
              <Select 
                value={tournamentFilter} 
                onValueChange={handleTournamentChange}
                disabled={availableTournaments.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tournament" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tournaments</SelectItem>
                  {availableTournaments.map(tournament => (
                    <SelectItem key={tournament} value={tournament}>
                      {tournament}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event List */}
      {hasPastEvents ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map(event => (
            <Card 
              key={event.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openEventDialog(event)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center">
                    <CountryFlag country={event.country} className="mr-2 h-3.5" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{event.country}</span>
                  </div>
                  <Badge variant="outline" className="text-xs h-5">
                    {formatDateTime(event.startTime)}
                  </Badge>
                </div>
                <CardTitle className="text-base font-semibold">{event.name}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {event.tournament}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {Object.keys(event.oddsData || {}).length} bookmakers
                </div>
                <div className="text-xs mt-1">
                  Click to view historical odds
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">No past events found</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              {tournamentFilter !== 'all' 
                ? "Try selecting a different tournament or clearing your filters." 
                : countryFilter !== 'all' 
                  ? "Try selecting a different country or clearing your filters."
                  : "There are no past events with recorded odds history yet."}
            </p>
            {(countryFilter !== 'all' || tournamentFilter !== 'all') && (
              <Button variant="secondary" onClick={resetFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Historical Odds Chart Popup */}
      {selectedEvent && (
        <HistoricalOddsChart 
          eventId={selectedEvent.eventId}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </div>
  );
}