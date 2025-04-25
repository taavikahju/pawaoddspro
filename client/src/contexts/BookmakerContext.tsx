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

// Define the context shape
interface BookmakerContextType {
  bookmakers: Bookmaker[];
  selectedBookmakers: string[];
  toggleBookmaker: (bookmakerId: string) => void;
  selectAllBookmakers: () => void;
  deselectAllBookmakers: () => void;
  isLoading: boolean;
}

// Create the context with default values
const BookmakerContext = createContext<BookmakerContextType>({
  bookmakers: [],
  selectedBookmakers: [],
  toggleBookmaker: () => {},
  selectAllBookmakers: () => {},
  deselectAllBookmakers: () => {},
  isLoading: false,
});

// Create a provider component
export const BookmakerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedBookmakers, setSelectedBookmakers] = useState<string[]>([]);
  
  // Fetch bookmakers data from API
  const { data: bookmakers = [], isLoading } = useQuery<Bookmaker[]>({
    queryKey: ['/api/bookmakers'],
    queryFn: async () => {
      const response = await axios.get('/api/bookmakers');
      return response.data;
    },
  });
  
  // Initialize selected bookmakers when data is loaded
  useEffect(() => {
    if (bookmakers.length > 0 && selectedBookmakers.length === 0) {
      // By default, select all active bookmakers
      setSelectedBookmakers(bookmakers.filter(b => b.active).map(b => b.code));
    }
  }, [bookmakers]);
  
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
      }}
    >
      {children}
    </BookmakerContext.Provider>
  );
};

// Create a hook to use the context
export const useBookmakerContext = () => useContext(BookmakerContext);