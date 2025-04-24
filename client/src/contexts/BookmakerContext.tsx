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
  marginFilter: number;
  isLoadingBookmakers: boolean;
  isLoadingSports: boolean;
  toggleBookmaker: (code: string) => void;
  toggleSport: (code: string) => void;
  toggleAutoRefresh: () => void;
  setMarginFilter: (value: number) => void;
  refreshData: () => Promise<void>;
  isRefreshing: boolean;
}

const BookmakerContext = createContext<BookmakerContextType | undefined>(undefined);

export function BookmakerProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [selectedBookmakers, setSelectedBookmakers] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [marginFilter, setMarginFilter] = useState<number>(15); // Default to max value (no filtering)

  // Fetch bookmakers
  const { 
    data: bookmakers = [], 
    isLoading: isLoadingBookmakers 
  } = useQuery({ 
    queryKey: ['/api/bookmakers'],
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Fetch sports
  const { 
    data: sports = [], 
    isLoading: isLoadingSports 
  } = useQuery({ 
    queryKey: ['/api/sports'],
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Initialize selected bookmakers and sports
  useEffect(() => {
    if (bookmakers.length > 0 && selectedBookmakers.length === 0) {
      setSelectedBookmakers(bookmakers.map((b: Bookmaker) => b.code));
    }
  }, [bookmakers, selectedBookmakers]);

  useEffect(() => {
    if (sports.length > 0 && selectedSports.length === 0) {
      // Default to Football and Basketball (first two sports)
      if (sports.length >= 2) {
        setSelectedSports([sports[0].code, sports[1].code]);
      } else if (sports.length === 1) {
        setSelectedSports([sports[0].code]);
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

  const refreshData = async () => {
    await refreshMutation();
  };

  const value = {
    bookmakers,
    sports,
    selectedBookmakers,
    selectedSports,
    autoRefresh,
    marginFilter,
    isLoadingBookmakers,
    isLoadingSports,
    toggleBookmaker,
    toggleSport,
    toggleAutoRefresh,
    setMarginFilter,
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
