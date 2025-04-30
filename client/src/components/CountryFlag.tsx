import React, { useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { GlobeIcon } from 'lucide-react';

interface CountryFlagProps {
  countryCode?: string;
  countryName?: string;
  country?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Map of country names to ISO codes
const countryCodeMap: Record<string, string> = {
  'England': 'GB',
  'Spain': 'ES',
  'Germany': 'DE',
  'Italy': 'IT',
  'France': 'FR',
  'Kenya': 'KE',
  'Ghana': 'GH',
  'Nigeria': 'NG',
  'Tanzania': 'TZ',
  'Uganda': 'UG',
  'South Africa': 'ZA',
  'Egypt': 'EG',
  'Morocco': 'MA',
  'Brazil': 'BR',
  'Argentina': 'AR',
  'Netherlands': 'NL',
  'Portugal': 'PT',
  'Belgium': 'BE',
  'Turkey': 'TR',
  'Croatia': 'HR',
  'Denmark': 'DK',
  'Norway': 'NO',
  'Sweden': 'SE',
  'Switzerland': 'CH',
  'Austria': 'AT',
  'Poland': 'PL',
  'Russia': 'RU',
  'United States': 'US',
  'Mexico': 'MX',
  'Canada': 'CA',
  'Australia': 'AU',
  'China': 'CN',
  'Japan': 'JP',
  'South Korea': 'KR',
};

export default function CountryFlag({ 
  countryCode, 
  countryName, 
  country,
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

  // Determine the correct country code to use
  let codeToUse = countryCode;
  let nameToUse = countryName;
  
  // If country prop is provided (for tournament margins page), use it to lookup code
  if (country) {
    codeToUse = countryCodeMap[country] || 'XX';
    nameToUse = country;
  }

  // Show placeholder globe icon if flag is missing or doesn't load
  if (!codeToUse || codeToUse === 'XX' || flagError) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <span title={nameToUse}>
          <GlobeIcon className={`${iconSize} text-gray-400`} />
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex ${className}`}>
      <ReactCountryFlag 
        countryCode={codeToUse} 
        svg 
        style={{
          width,
          height
        }}
        title={nameToUse}
        onError={() => setFlagError(true)}
      />
    </div>
  );
}