import React, { useState } from 'react';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const OfficeSelector = ({ selectedOffice, onOfficeChange, offices }) => {
  return (
    <div className="flex items-center gap-3">
      <Icon name="Building2" size={20} color="var(--color-primary)" />
      <Select
        options={offices}
        value={selectedOffice}
        onChange={onOfficeChange}
        placeholder="Select Office"
        searchable
        className="min-w-[200px]"
      />
    </div>
  );
};

export default OfficeSelector;