import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import ScraperStatusCard from '@/components/ScraperStatusCard';
import ScraperActivityFeed from '@/components/ScraperActivityFeed';
import { Database, Server, Clock, AlertCircle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';

export default function ScraperStatus() {
  const { toast } = useToast();
  const { isConnected, runScrapers } = useWebSocket();
  
  // Fetch scraper statuses
  const { 
    data: scraperStatuses = [],
    isLoading 
  } = useQuery({ 
    queryKey: ['/api/scrapers/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Count the number of active scrapers
  const activeScrapers = scraperStatuses.filter((scraper: any) => 
    scraper.status === 'Running'
  ).length;
  
  // Handle manual trigger of scrapers
  const handleRunScrapers = () => {
    if (!isConnected) {
      toast({
        title: "WebSocket not connected",
        description: "Cannot trigger scrapers. Please try again later.",
        variant: "destructive"
      });
      return;
    }
    
    runScrapers();
    toast({
      title: "Scrapers triggered",
      description: "Scrapers are now running. This may take a few minutes.",
    });
  };
  
  return (
    <Layout 
      title="Scraper Status"
      subtitle="Monitor bookmaker data collection"
    >
      {/* Action buttons removed as per client request */}

      {/* Header with stats */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-6 shadow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Database className="h-5 w-5 mr-2 text-primary" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Scrapers Overview</h2>
          </div>
          
          <div className="flex items-center">
            <div className={`h-2.5 w-2.5 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-4">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
          <div className="flex items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Server className="h-8 w-8 text-blue-500 dark:text-blue-400 mr-3" />
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300">Total Scrapers</p>
              <p className="text-xl font-bold text-blue-800 dark:text-blue-200">{scraperStatuses.length}</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Clock className="h-8 w-8 text-green-500 dark:text-green-400 mr-3" />
            <div>
              <p className="text-sm text-green-700 dark:text-green-300">Active Scrapers</p>
              <p className="text-xl font-bold text-green-800 dark:text-green-200">{activeScrapers}</p>
            </div>
          </div>
          
          <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400 mr-3" />
            <div>
              <p className="text-sm text-red-700 dark:text-red-300">Inactive Scrapers</p>
              <p className="text-xl font-bold text-red-800 dark:text-red-200">{scraperStatuses.length - activeScrapers}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center mt-2">
          <div className={`h-2.5 w-2.5 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isConnected 
              ? "WebSocket connected. Real-time updates active." 
              : "WebSocket disconnected. Reconnecting..."}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          {/* Scraper Cards */}
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
            <Server className="h-4 w-4 mr-2 text-primary" />
            Scraper Status
          </h3>
          
          {isLoading ? (
            <div className="h-64 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scraperStatuses.map((scraper: any, index: number) => (
                <ScraperStatusCard
                  key={index}
                  name={scraper.name}
                  status={scraper.status}
                  lastRun={scraper.lastRun}
                  nextRun={scraper.nextRun}
                  eventCount={scraper.eventCount}
                  fileSize={scraper.fileSize}
                />
              ))}
            </div>
          )}
        </div>
        
        <div>
          {/* Activity Feed */}
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center">
            <Activity className="h-4 w-4 mr-2 text-primary" />
            Real-time Activity
          </h3>
          
          <ScraperActivityFeed />
        </div>
      </div>
      
      {/* Footer Note */}
      <div className="text-center text-xs text-gray-500 dark:text-gray-400 mb-4">
        <p>Data is collected from bookmaker APIs every 15 minutes automatically.</p>
        <p className="mt-1">Admin users can trigger manual scraping from the Admin Panel.</p>
      </div>
    </Layout>
  );
}
