import React from 'react';
import ReactCountryFlag from 'react-country-flag';

const COUNTRY_TO_CODE: Record<string, string> = {
  'England': 'GB-ENG',
  'Scotland': 'GB-SCT',
  'Wales': 'GB-WLS',
  'Northern Ireland': 'GB-NIR',
  'Great Britain': 'GB',
  'Spain': 'ES',
  'Germany': 'DE',
  'Italy': 'IT',
  'France': 'FR',
  'Portugal': 'PT',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'Ghana': 'GH',
  'Kenya': 'KE',
  'Nigeria': 'NG',
  'South Africa': 'ZA',
  'Tanzania': 'TZ',
  'Uganda': 'UG',
  'Rwanda': 'RW',
  'Brazil': 'BR',
  'Argentina': 'AR',
  'Mexico': 'MX',
  'USA': 'US',
  'Canada': 'CA',
  'Japan': 'JP',
  'South Korea': 'KR',
  'China': 'CN',
  'Australia': 'AU',
  'Ukraine': 'UA',
  'Russia': 'RU',
  'Poland': 'PL',
  'Turkey': 'TR',
  'Sweden': 'SE',
  'Denmark': 'DK',
  'Norway': 'NO',
  'Austria': 'AT',
  'Switzerland': 'CH',
  'Croatia': 'HR',
  'Serbia': 'RS',
  'Greece': 'GR',
  'Czech Republic': 'CZ',
  'Romania': 'RO',
  'Uruguay': 'UY',
  'Colombia': 'CO',
  'Chile': 'CL',
  'Peru': 'PE',
  'Ecuador': 'EC',
  'Venezuela': 'VE',
  'Bolivia': 'BO',
  'Paraguay': 'PY',
  'Egypt': 'EG',
  'Morocco': 'MA',
  'Tunisia': 'TN',
  'Algeria': 'DZ',
  'Senegal': 'SN',
  'Ivory Coast': 'CI',
  'Cameroon': 'CM',
  'World': 'UN' // Using United Nations flag for global events
};

interface CountryFlagProps {
  country?: string;
  countryCode?: string;
  countryName?: string;
  size?: string;
  className?: string;
}

const CountryFlag: React.FC<CountryFlagProps> = ({ 
  country, 
  countryCode: propCountryCode, 
  countryName,
  size,
  className = '' 
}) => {
  // Use provided country code or lookup from country name
  const displayCountry = countryName || country || '';
  const code = propCountryCode || (country && COUNTRY_TO_CODE[country] ? COUNTRY_TO_CODE[country] : '');
  
  if (!code) {
    // If we don't have a mapping, just show the country name
    return <span className={className}>{displayCountry}</span>;
  }
  
  // For Great Britain's countries, we need a special case
  if (code.startsWith('GB-')) {
    return <span className={className}>{displayCountry}</span>;
  }
  
  const style = size === 'sm' ? { width: '16px', height: '16px' } : {};
  
  return (
    <ReactCountryFlag 
      countryCode={code} 
      svg 
      style={style}
      className={className}
      title={displayCountry}
    />
  );
};

export default CountryFlag;