import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookmakerProvider } from "./contexts/BookmakerContext";
import { Toaster } from "@/components/ui/toaster";
import App from "./App";
import "./index.css";

// Create a client for react-query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BookmakerProvider>
      <App />
      <Toaster />
    </BookmakerProvider>
  </QueryClientProvider>
);
