import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import ScraperStatusCard from '@/components/ScraperStatusCard';

export default function ScraperStatus() {
  // Fetch scraper statuses
  const { 
    data: scraperStatuses = [],
    isLoading 
  } = useQuery({ 
    queryKey: ['/api/scrapers/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  return (
    <Layout 
      title="Scraper Status"
      subtitle="Monitor bookmaker data collection"
    >
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Scraper Status</h2>
      
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
    </Layout>
  );
}
