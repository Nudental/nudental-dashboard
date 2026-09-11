import React from 'react';
import Icon from '../../../components/AppIcon';

const RoleAccessBanner = ({ role, officeCount, officeName }) => {
  if (role === 'super_admin') return null;

  if (officeCount > 1) {
    return (
      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4">
        <Icon name="Info" size={16} color="#3b82f6" className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Multi-Office View</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            You are assigned to {officeCount} offices. Showing comparison across your assigned locations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mb-4">
      <Icon name="AlertCircle" size={16} color="#f59e0b" className="mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Single Office View</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          Showing <strong>{officeName || 'your office'}</strong> performance compared against the company average.
          Contact a Super Admin to access full multi-office comparison.
        </p>
      </div>
    </div>
  );
};

export default RoleAccessBanner;
