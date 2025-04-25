import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import ScraperStatus from "@/pages/scraper-status";
import AdminPage from "@/pages/admin";
import HistoricalOdds from "@/pages/historical-odds";
import NotificationListener from "@/components/NotificationListener";
import { BookmakerProvider } from "@/contexts/BookmakerContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/historical-odds" component={HistoricalOdds} />
      <Route path="/scraper-status" component={ScraperStatus} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class">
        <TooltipProvider>
          <BookmakerProvider>
            <Toaster />
            <NotificationListener />
            <Router />
          </BookmakerProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
