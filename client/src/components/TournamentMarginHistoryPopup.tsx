import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

interface MarginHistoryItem {
  id: number;
  bookmakerCode: string;
  countryName: string;
  tournamentName: string;
  averageMargin: string;
  eventCount: number;
  timestamp: string;
}

interface TournamentMarginHistoryPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentName: string;
  bookmakerCode: string;
  bookmakerName: string;
}

export default function TournamentMarginHistoryPopup({
  open,
  onOpenChange,
  tournamentName,
  bookmakerCode,
  bookmakerName
}: TournamentMarginHistoryPopupProps) {
  // Convert UI bookmaker codes to database codes
  let dbBookmakerCode = bookmakerCode;
  if (bookmakerCode === 'bp GH') dbBookmakerCode = 'betpawa_gh';
  else if (bookmakerCode === 'bp KE') dbBookmakerCode = 'betpawa_ke';

  // Fetch margin history data
  const { data, isLoading, error } = useQuery<MarginHistoryItem[]>({
    queryKey: ['/api/tournaments/margins', tournamentName, dbBookmakerCode],
    queryFn: () => 
      fetch(`/api/tournaments/margins?tournament=${encodeURIComponent(tournamentName)}&bookmaker=${encodeURIComponent(dbBookmakerCode)}`)
        .then(res => res.json()),
    enabled: open,
  });

  // Process data for the chart
  const chartData = React.useMemo(() => {
    if (!data) return [];
    
    return data.map(item => ({
      date: format(new Date(item.timestamp), 'dd MMM HH:mm'),
      margin: (parseFloat(item.averageMargin) * 100).toFixed(2),
      eventCount: item.eventCount,
      timestamp: item.timestamp
    }));
  }, [data]);

  // Get color based on margin value
  const getMarginColor = (margin: number): string => {
    if (margin < 5.0) return '#16a34a'; // green-600
    if (margin < 7.5) return '#65a30d'; // lime-600
    if (margin < 10.0) return '#d97706'; // amber-600
    if (margin < 12.5) return '#ea580c'; // orange-600
    return '#dc2626'; // red-600
  };

  // Get chart color based on average margin
  const chartColor = React.useMemo(() => {
    if (!chartData.length) return '#16a34a';
    const avgMargin = chartData.reduce((sum, item) => sum + parseFloat(item.margin), 0) / chartData.length;
    return getMarginColor(avgMargin);
  }, [chartData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DialogClose className="absolute left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </DialogClose>
            {tournamentName} - {bookmakerName}
          </DialogTitle>
          <DialogDescription>
            Average margin history for this tournament and bookmaker over time
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">
            Failed to load margin history
          </div>
        ) : chartData.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No margin history data available
          </div>
        ) : (
          <div className="py-2">
            <div className="text-sm text-muted-foreground mb-4">
              Displaying {chartData.length} data points from {format(new Date(chartData[0].timestamp), 'dd MMM yyyy')} to {format(new Date(chartData[chartData.length - 1].timestamp), 'dd MMM yyyy')}
            </div>
            
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }} 
                  tickMargin={10}
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis 
                  tickFormatter={(value) => `${value}%`}
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip 
                  formatter={(value) => [`${value}%`, 'Margin']}
                  labelFormatter={(date) => `Date: ${date}`}
                  contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="margin" 
                  name="Margin (%)" 
                  stroke={chartColor}
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
            
            <div className="text-xs text-right text-muted-foreground mt-2">
              Note: Events used for calculation may vary between data points
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}