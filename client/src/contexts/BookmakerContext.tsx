import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Bookmaker {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

interface Sport {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

interface BookmakerContextType {
  bookmakers: Bookmaker[];
  sports: Sport[];
  selectedBookmakers: string[];
  selectedSports: string[];
  autoRefresh: boolean;
  minMarginFilter: number;
  maxMarginFilter: number;
  isLoadingBookmakers: boolean;
  isLoadingSports: boolean;
  isTop5LeaguesActive: boolean;
  toggleBookmaker: (code: string) => void;
  toggleSport: (code: string) => void;
  toggleAutoRefresh: () => void;
  toggleTop5LeaguesFilter: () => void;
  setMinMarginFilter: (value: number) => void;
  setMaxMarginFilter: (value: number) => void;
  resetMarginFilters: () => void;
  refreshData: () => Promise<void>;
  isRefreshing: boolean;
}

const BookmakerContext = createContext<BookmakerContextType | undefined>(undefined);

export function BookmakerProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [selectedBookmakers, setSelectedBookmakers] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [minMarginFilter, setMinMarginFilter] = useState<number>(0); // Default to min value
  const [maxMarginFilter, setMaxMarginFilter] = useState<number>(15); // Default to max value (no filtering)

  // Fetch bookmakers
  const { 
    data: bookmakers = [] as Bookmaker[], 
    isLoading: isLoadingBookmakers 
  } = useQuery<Bookmaker[]>({ 
    queryKey: ['/api/bookmakers'],
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Fetch sports
  const { 
    data: sports = [] as Sport[], 
    isLoading: isLoadingSports 
  } = useQuery<Sport[]>({ 
    queryKey: ['/api/sports'],
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Initialize selected bookmakers and sports
  useEffect(() => {
    if (bookmakers.length > 0 && selectedBookmakers.length === 0) {
      // Sort bookmakers by ID for consistent order before setting initial selection
      const sortedBookmakers = [...(bookmakers as Bookmaker[])].sort((a, b) => a.id - b.id);
      setSelectedBookmakers(sortedBookmakers.map(b => b.code));
    }
  }, [bookmakers, selectedBookmakers]);

  useEffect(() => {
    if (sports.length > 0 && selectedSports.length === 0) {
      // Sort sports by ID for consistent order before setting initial selection
      const sortedSports = [...(sports as Sport[])].sort((a, b) => a.id - b.id);
      
      // Default to Football and Basketball (first two sports)
      if (sortedSports.length >= 2) {
        setSelectedSports([sortedSports[0].code, sortedSports[1].code]);
      } else if (sortedSports.length === 1) {
        setSelectedSports([sortedSports[0].code]);
      }
    }
  }, [sports, selectedSports]);

  // Manual refresh mutation
  const { mutateAsync: refreshMutation, isPending: isRefreshing } = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/scrapers/refresh', {});
    },
    onSuccess: () => {
      toast({
        title: "Data refreshed",
        description: "The latest bookmaker odds have been fetched",
        duration: 3000,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scrapers/status'] });
    },
    onError: (error) => {
      toast({
        title: "Refresh failed",
        description: "Could not refresh bookmaker data",
        variant: "destructive",
        duration: 3000,
      });
      console.error("Error refreshing data:", error);
    }
  });

  const toggleBookmaker = (code: string) => {
    setSelectedBookmakers(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const toggleSport = (code: string) => {
    setSelectedSports(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };

  const resetMarginFilters = () => {
    setMinMarginFilter(0);
    setMaxMarginFilter(15);
  };

  const refreshData = async () => {
    await refreshMutation();
  };

  const value: BookmakerContextType = {
    bookmakers: bookmakers as Bookmaker[],
    sports: sports as Sport[],
    selectedBookmakers,
    selectedSports,
    autoRefresh,
    minMarginFilter,
    maxMarginFilter,
    isLoadingBookmakers,
    isLoadingSports,
    toggleBookmaker,
    toggleSport,
    toggleAutoRefresh,
    setMinMarginFilter,
    setMaxMarginFilter,
    resetMarginFilters,
    refreshData,
    isRefreshing
  };

  return (
    <BookmakerContext.Provider value={value}>
      {children}
    </BookmakerContext.Provider>
  );
}

export function useBookmakerContext() {
  const context = useContext(BookmakerContext);
  if (context === undefined) {
    throw new Error("useBookmakerContext must be used within a BookmakerProvider");
  }
  return context;
}
