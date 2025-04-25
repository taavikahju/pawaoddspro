import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// Define the shape of our bookmaker data
interface Bookmaker {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

// Define sport type
interface Sport {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

// Define the context shape
interface BookmakerContextType {
  bookmakers: Bookmaker[];
  selectedBookmakers: string[];
  toggleBookmaker: (bookmakerId: string) => void;
  selectAllBookmakers: () => void;
  deselectAllBookmakers: () => void;
  isLoading: boolean;
  
  // Additional properties used in Sidebar
  sports: Sport[];
  selectedSports: string[];
  autoRefresh: boolean;
  minMarginFilter: number;
  maxMarginFilter: number;
  toggleSport: (sportId: string) => void;
  toggleAutoRefresh: () => void;
  setMinMarginFilter: (value: number) => void;
  setMaxMarginFilter: (value: number) => void;
  resetMarginFilters: () => void;
  refreshData: () => void;
  isRefreshing: boolean;
}

// Create the context with default values
const BookmakerContext = createContext<BookmakerContextType>({
  bookmakers: [],
  selectedBookmakers: [],
  toggleBookmaker: () => {},
  selectAllBookmakers: () => {},
  deselectAllBookmakers: () => {},
  isLoading: false,
  
  // Default values for additional properties
  sports: [],
  selectedSports: [],
  autoRefresh: false,
  minMarginFilter: 0,
  maxMarginFilter: 100,
  toggleSport: () => {},
  toggleAutoRefresh: () => {},
  setMinMarginFilter: () => {},
  setMaxMarginFilter: () => {},
  resetMarginFilters: () => {},
  refreshData: () => {},
  isRefreshing: false,
});

// Create a provider component
export const BookmakerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedBookmakers, setSelectedBookmakers] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [minMarginFilter, setMinMarginFilter] = useState<number>(0);
  const [maxMarginFilter, setMaxMarginFilter] = useState<number>(100);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Fetch bookmakers data from API
  const { data: bookmakers = [], isLoading } = useQuery<Bookmaker[]>({
    queryKey: ['/api/bookmakers'],
    queryFn: async () => {
      const response = await axios.get('/api/bookmakers');
      return response.data;
    },
  });
  
  // Fetch sports data from API (stub)
  const { data: sports = [] } = useQuery<Sport[]>({
    queryKey: ['/api/sports'],
    queryFn: async () => {
      // This is a placeholder. Implement actual API call when sports endpoint is available
      return [];
    },
  });
  
  // Initialize selected bookmakers when data is loaded
  useEffect(() => {
    if (bookmakers.length > 0 && selectedBookmakers.length === 0) {
      // By default, select all active bookmakers
      setSelectedBookmakers(bookmakers.filter(b => b.active).map(b => b.code));
    }
  }, [bookmakers]);
  
  // Initialize selected sports when data is loaded
  useEffect(() => {
    if (sports.length > 0 && selectedSports.length === 0) {
      // By default, select all active sports
      setSelectedSports(sports.filter(s => s.active).map(s => s.code));
    }
  }, [sports]);
  
  // Toggle a bookmaker selection
  const toggleBookmaker = (bookmakerCode: string) => {
    setSelectedBookmakers(prev => {
      if (prev.includes(bookmakerCode)) {
        return prev.filter(code => code !== bookmakerCode);
      } else {
        return [...prev, bookmakerCode];
      }
    });
  };
  
  // Toggle a sport selection
  const toggleSport = (sportCode: string) => {
    setSelectedSports(prev => {
      if (prev.includes(sportCode)) {
        return prev.filter(code => code !== sportCode);
      } else {
        return [...prev, sportCode];
      }
    });
  };
  
  // Toggle auto refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };
  
  // Set minimum margin filter
  const setMinMarginFilterValue = (value: number) => {
    setMinMarginFilter(value);
  };
  
  // Set maximum margin filter
  const setMaxMarginFilterValue = (value: number) => {
    setMaxMarginFilter(value);
  };
  
  // Reset margin filters
  const resetMarginFilters = () => {
    setMinMarginFilter(0);
    setMaxMarginFilter(100);
  };
  
  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // Implement data refresh logic here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Select all bookmakers
  const selectAllBookmakers = () => {
    setSelectedBookmakers(bookmakers.map(b => b.code));
  };
  
  // Deselect all bookmakers
  const deselectAllBookmakers = () => {
    setSelectedBookmakers([]);
  };
  
  return (
    <BookmakerContext.Provider
      value={{
        bookmakers,
        selectedBookmakers,
        toggleBookmaker,
        selectAllBookmakers,
        deselectAllBookmakers,
        isLoading,
        sports,
        selectedSports,
        autoRefresh,
        minMarginFilter,
        maxMarginFilter,
        toggleSport,
        toggleAutoRefresh,
        setMinMarginFilter: setMinMarginFilterValue,
        setMaxMarginFilter: setMaxMarginFilterValue,
        resetMarginFilters,
        refreshData,
        isRefreshing,
      }}
    >
      {children}
    </BookmakerContext.Provider>
  );
};

// Create a hook to use the context
export const useBookmakerContext = () => useContext(BookmakerContext);