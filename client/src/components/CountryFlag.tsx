import React, { useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { GlobeIcon } from 'lucide-react';

interface CountryFlagProps {
  countryCode: string;
  countryName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function CountryFlag({ 
  countryCode, 
  countryName, 
  size = 'md',
  className = '' 
}: CountryFlagProps) {
  const [flagError, setFlagError] = useState(false);
  
  // Size mapping
  const sizeMap = {
    sm: {
      width: '1em',
      height: '1em',
      iconSize: 'h-3 w-3'
    },
    md: {
      width: '1.2em',
      height: '1.2em',
      iconSize: 'h-4 w-4'
    },
    lg: {
      width: '1.5em',
      height: '1.5em',
      iconSize: 'h-5 w-5'
    }
  };
  
  const { width, height, iconSize } = sizeMap[size];

  // Show placeholder globe icon if flag is missing or doesn't load
  if (countryCode === 'XX' || flagError) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <span title={countryName}>
          <GlobeIcon className={`${iconSize} text-gray-400`} />
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex ${className}`}>
      <ReactCountryFlag 
        countryCode={countryCode} 
        svg 
        style={{
          width,
          height
        }}
        title={countryName}
        onError={() => setFlagError(true)}
      />
    </div>
  );
}