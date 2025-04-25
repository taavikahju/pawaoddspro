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
import { Button } from '@/components/ui/button';
import { Loader2, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useBookmakerContext } from '@/contexts/BookmakerContext';
import { useToast } from '@/hooks/use-toast';
import CountryFlag from '../components/CountryFlag';
import OddsHistoryPopup from '../components/OddsHistoryPopup';
import Layout from '@/components/Layout';

import { Event } from '../types/event';

// We don't need the OddsHistoryEntry type anymore since
// it's now handled in OddsHistoryPopup component

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

  // Fetch past events (only events that have already finished)
  const { 
    data: events = [],
    isLoading: isLoadingEvents,
    isError,
    error
  } = useQuery<Event[]>({ 
    queryKey: ['/api/events', 'past', countryFilter, tournamentFilter],
    queryFn: async () => {
      // Get only past events with the time filter properly applied
      const params: Record<string, string> = { 
        past_only: 'true',
        minBookmakers: '3'
      };
      
      // Add filters if not 'all'
      if (countryFilter !== 'all') params.country = countryFilter;
      if (tournamentFilter !== 'all') params.tournament = tournamentFilter;
      
      console.log('Fetching past events with params:', params);
      const response = await axios.get('/api/events', { params });
      
      // For debugging: Log sample events
      if (response.data.length > 0) {
        console.log('Sample event:', response.data[0]);
        
        // Check if date fields are valid
        if (response.data[0].date) {
          console.log('Event date sample:', {
            date: response.data[0].date,
            time: response.data[0].time,
            startTime: response.data[0].startTime,
            startTimeFormatted: response.data[0].startTime ? new Date(response.data[0].startTime).toISOString() : 'N/A',
            start_time: response.data[0].start_time,
            start_time_formatted: response.data[0].start_time ? new Date(response.data[0].start_time).toISOString() : 'N/A'
          });
        }
      }
      
      console.log('Historical events response:', {
        count: response.data.length,
        firstItem: response.data.length > 0 ? response.data[0] : null,
        status: response.status
      });
      
      return response.data;
    },
    refetchOnWindowFocus: false
  });

  // We don't need to fetch the history data here anymore
  // The OddsHistoryPopup component will handle that for us

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
  const formatDateTime = (event: Event) => {
    let date: Date;
    
    // Check all possible time fields
    if (event.startTime) {
      date = new Date(event.startTime);
    } else if (event.start_time) {
      date = new Date(event.start_time);
    } else if (event.date && event.time) {
      date = new Date(`${event.date} ${event.time}`);
    } else {
      return "No date available";
    }
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };
  
  // Get event name (using teams as fallback)
  const getEventName = (event: Event) => {
    return event.name || event.teams || "Unknown Event";
  };
  
  // Render loading state
  if (isLoadingEvents) {
    return (
      <Layout 
        title="Historical Odds"
        subtitle="View and analyze historical odds for past events"
      >
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading historical events...</span>
        </div>
      </Layout>
    );
  }

  // Render error state
  if (isError) {
    return (
      <Layout 
        title="Historical Odds"
        subtitle="View and analyze historical odds for past events"
      >
        <div className="flex flex-col items-center justify-center h-96">
          <div className="text-red-500 mb-4 text-lg">
            Error loading events: {(error as Error).message}
          </div>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </Layout>
    );
  }

  // Check if we have past events
  const hasPastEvents = events.length > 0;

  // Only show events when both country and tournament are selected
  const shouldShowEvents = countryFilter !== 'all' && tournamentFilter !== 'all';
  
  // Filter events by country first, then by tournament
  const filteredEvents = events
    .filter(event => countryFilter === 'all' || event.country === countryFilter)
    .filter(event => tournamentFilter === 'all' || event.tournament === tournamentFilter);

  return (
    <Layout 
      title="Historical Odds"
      subtitle="View and analyze historical odds for past events"
    >
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Filters - Now in left sidebar */}
          <div className="md:w-1/4 w-full">
            <Card className="sticky top-4">
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
                      <X className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
                <CardDescription>Filter historical events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
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
                      disabled={countryFilter === 'all' || availableTournaments.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={countryFilter === 'all' ? "Select country first" : "Select tournament"} />
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
                    {countryFilter === 'all' && (
                      <p className="text-xs text-muted-foreground mt-1">Please select a country first</p>
                    )}
                  </div>
                  
                  {(countryFilter !== 'all' || tournamentFilter !== 'all') && (
                    <Button 
                      variant="outline" 
                      onClick={resetFilters} 
                      className="w-full mt-2"
                    >
                      <X className="h-4 w-4 mr-2" /> Clear All Filters
                    </Button>
                  )}
                  
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    <p>Found {filteredEvents.length} events</p>
                    {tournamentFilter !== 'all' && (
                      <p className="mt-1">Tournament: {tournamentFilter}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Event List - Now on the right side */}
          <div className="md:w-3/4 w-full">
            {!shouldShowEvents ? (
              <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 h-64">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">Select filters to view events</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                    Please select both a country and tournament to view historical events
                  </p>
                </div>
              </div>
            ) : filteredEvents.length > 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-md shadow">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Event
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Bookmakers
                      </th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredEvents.map((event, idx) => (
                      <tr 
                        key={event.id}
                        className={`${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/50'} hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors`}
                        onClick={() => openEventDialog(event)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {getEventName(event)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {event.tournament}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDateTime(event)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {Object.keys(event.oddsData || {}).length}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <Button variant="ghost" size="sm" className="text-xs h-7">
                            View Odds
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8 h-64">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">No past events found</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                    No events match your current filter selection
                  </p>
                  {(countryFilter !== 'all' || tournamentFilter !== 'all') && (
                    <Button variant="secondary" onClick={resetFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Historical Odds Popup */}
        <OddsHistoryPopup
          event={selectedEvent}
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
      </div>
    </Layout>
  );
}