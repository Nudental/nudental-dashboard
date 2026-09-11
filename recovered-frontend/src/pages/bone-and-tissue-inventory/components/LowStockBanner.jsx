import React from 'react';
import Icon from '../../../components/AppIcon';

const LowStockBanner = ({ lowStockItems, onDismiss }) => {
  if (!lowStockItems || lowStockItems?.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon name="AlertTriangle" size={16} className="text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-bold text-red-800">Low Stock Alert</h4>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
              {lowStockItems?.length}
            </span>
          </div>
          <div className="space-y-1">
            {lowStockItems?.map(item => (
              <p key={item?.id} className="text-xs text-red-700">
                <span className="font-semibold">{item?.product_name}</span>
                {item?.identification_number && (
                  <span className="text-red-500 ml-1 font-mono">(#{item?.identification_number})</span>
                )}
                {' '}has{' '}
                <span className="font-bold">{item?.current_stock}</span>
                {' '}unit{item?.current_stock !== 1 ? 's' : ''} remaining
                {item?.office_name && (
                  <span className="text-red-500 ml-1">at {item?.office_name?.replace('Nu Dental of ', '')}</span>
                )}
              </p>
            ))}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
          >
            <Icon name="X" size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default LowStockBanner;
