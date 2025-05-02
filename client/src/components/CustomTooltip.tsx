import React from 'react';

interface CustomToolTipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  dataPoints?: any[];
  findDataPoint?: (label: string) => any;
}

export const CustomTooltip = ({ active, payload, label, dataPoints, findDataPoint }: CustomToolTipProps) => {
  if (!active || !payload || !payload.length || !label) {
    return null;
  }

  // Find the data point with the complete timestamp
  const dataPoint = findDataPoint ? findDataPoint(label) : 
                    dataPoints ? dataPoints.find(dp => dp.timestamp === label) : null;
  
  return (
    <div className="custom-tooltip bg-background border border-border rounded-md shadow-md p-3">
      <div className="font-semibold text-xs mb-2 text-foreground">
        Date/Time: {label}
      </div>
      {dataPoint && dataPoint.date && (
        <div className="text-xs mb-2 text-muted-foreground border-b border-border pb-2">
          Full Timestamp: {dataPoint.date.toISOString()}
        </div>
      )}
      <div className="mt-1">
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center text-xs mb-1">
            <div 
              className="w-3 h-3 mr-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-medium mr-2">{entry.name}:</span>
            <span className="text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomTooltip;