import React from 'react';
import { Checkbox } from '../../../components/ui/Checkbox';

const ProviderFilter = ({ selectedProviders, onProviderChange }) => {
  const providerTypes = [
    { value: 'doctor', label: 'Doctors' },
    { value: 'hygienist', label: 'Hygienists' },
    { value: 'house', label: 'House' }
  ];

  return (
    <div className="flex items-center gap-4 md:gap-6">
      <span className="text-sm font-medium text-foreground">Providers:</span>
      <div className="flex flex-wrap gap-4">
        {providerTypes?.map((provider) => (
          <Checkbox
            key={provider?.value}
            label={provider?.label}
            checked={selectedProviders?.includes(provider?.value)}
            onChange={(e) => onProviderChange(provider?.value, e?.target?.checked)}
            size="sm"
          />
        ))}
      </div>
    </div>
  );
};

export default ProviderFilter;