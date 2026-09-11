import React from 'react';
import Icon from '../../../components/AppIcon';

const OFFICES = [
  'All Offices',
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

const INVENTORY_TYPES = ['All', 'Bone', 'Tissue', 'Membrane', 'PRF', 'Implant'];

const DashboardHeader = ({ officeFilter, setOfficeFilter, typeFilter, setTypeFilter, onRefresh, loading }) => {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Inventory Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Unified view across all practice locations</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Office Filter */}
          <div className="flex items-center gap-2">
            <Icon name="Building2" size={16} className="text-gray-400" />
            <select
              value={officeFilter}
              onChange={e => setOfficeFilter(e?.target?.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
            >
              {OFFICES?.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Inventory Type Filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {INVENTORY_TYPES?.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  typeFilter === t
                    ? 'bg-white text-blue-700 shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <Icon name="RefreshCw" size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
