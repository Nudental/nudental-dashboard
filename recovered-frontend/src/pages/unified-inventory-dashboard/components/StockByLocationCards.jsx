import React from 'react';
import Icon from '../../../components/AppIcon';

const SHORT_NAMES = {
  'Nu Dental of Eatontown': 'Eatontown',
  'Nu Dental of Brick': 'Brick',
  'Nu Dental of Barnegat': 'Barnegat',
  'Nu Dental of Staten Island': 'Staten Island',
};

const StockByLocationCards = ({ data, loading, activeOffice, onCardClick }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1,2,3,4]?.map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {(data || [])?.map(loc => {
        const isActive = activeOffice === loc?.office;
        return (
          <button
            key={loc?.office}
            onClick={() => onCardClick(loc?.office)}
            className={`text-left bg-white rounded-xl border-2 p-5 transition-all hover:shadow-md ${
              isActive ? 'border-blue-500 shadow-md ring-2 ring-blue-100' : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Office</p>
                <h3 className="text-base font-bold text-gray-900 mt-0.5" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  {SHORT_NAMES?.[loc?.office] || loc?.office}
                </h3>
              </div>
              <div className={`p-2 rounded-lg ${ isActive ? 'bg-blue-100' : 'bg-gray-100' }`}>
                <Icon name="Building2" size={18} className={isActive ? 'text-blue-600' : 'text-gray-500'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-blue-50 rounded-lg p-2.5">
                <p className="text-xs text-blue-600 font-medium">Bone/Tissue</p>
                <p className="text-xl font-bold text-blue-700">{loc?.boneTissueTotal}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-2.5">
                <p className="text-xs text-indigo-600 font-medium">Implants</p>
                <p className="text-xl font-bold text-indigo-700">{loc?.implantTotal}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {loc?.lowStockCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                  <Icon name="AlertTriangle" size={11} />
                  {loc?.lowStockCount} Low
                </span>
              )}
              {loc?.expiredCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                  <Icon name="XCircle" size={11} />
                  {loc?.expiredCount} Expired
                </span>
              )}
              {loc?.expiringSoonCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                  <Icon name="Clock" size={11} />
                  {loc?.expiringSoonCount} Soon
                </span>
              )}
              {loc?.lowStockCount === 0 && loc?.expiredCount === 0 && loc?.expiringSoonCount === 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                  <Icon name="CheckCircle" size={11} />
                  Healthy
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StockByLocationCards;
