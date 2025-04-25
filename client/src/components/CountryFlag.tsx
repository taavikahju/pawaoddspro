import React from 'react';
import ReactCountryFlag from 'react-country-flag';
import { cn } from '@/lib/utils';

export interface CountryFlagProps {
  country: string;
  className?: string;
}

// Map of country names to ISO codes
const COUNTRY_TO_ISO: Record<string, string> = {
  'England': 'GB-ENG',
  'Scotland': 'GB-SCT',
  'Wales': 'GB-WLS',
  'Ireland': 'IE',
  'Northern Ireland': 'GB-NIR',
  'International': 'XX', // Special case
  'International Clubs': 'XX', // Special case
  'UK': 'GB',
  'USA': 'US',
  'United States': 'US',
  'Germany': 'DE',
  'Spain': 'ES',
  'Italy': 'IT',
  'France': 'FR',
  'Netherlands': 'NL',
  'Portugal': 'PT',
  'Belgium': 'BE',
  'Denmark': 'DK',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Finland': 'FI',
  'Poland': 'PL',
  'Austria': 'AT',
  'Switzerland': 'CH',
  'Croatia': 'HR',
  'Greece': 'GR',
  'Turkey': 'TR',
  'Russia': 'RU',
  'Ukraine': 'UA',
  'Czech Republic': 'CZ',
  'Romania': 'RO',
  'Hungary': 'HU',
  'Brazil': 'BR',
  'Argentina': 'AR',
  'Mexico': 'MX',
  'Colombia': 'CO',
  'Peru': 'PE',
  'Chile': 'CL',
  'Uruguay': 'UY',
  'Japan': 'JP',
  'South Korea': 'KR',
  'China': 'CN',
  'Australia': 'AU',
  'New Zealand': 'NZ',
  'South Africa': 'ZA',
  'Nigeria': 'NG',
  'Egypt': 'EG',
  'Kenya': 'KE',
  'Ghana': 'GH'
};

/**
 * Component to display a country flag based on country name
 */
const CountryFlag: React.FC<CountryFlagProps> = ({ country, className }) => {
  const isoCode = COUNTRY_TO_ISO[country] || '';
  
  // For international/unknown countries, return a fallback
  if (!isoCode || isoCode === 'XX') {
    return (
      <span className={cn("inline-block w-5 text-xs", className)}>🌍</span>
    );
  }
  
  return (
    <ReactCountryFlag
      countryCode={isoCode.substring(0, 2)} // ReactCountryFlag only works with 2-letter ISO codes
      svg
      className={cn("rounded-sm", className)}
      title={country}
      style={{
        width: '1em',
        height: '1em'
      }}
    />
  );
};

export default CountryFlag;