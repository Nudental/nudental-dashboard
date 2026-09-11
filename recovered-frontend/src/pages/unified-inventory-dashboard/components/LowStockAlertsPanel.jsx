import React from 'react';
import Icon from '../../../components/AppIcon';

const getStatusBadge = (stock) => {
  if (stock === 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Out of Stock</span>;
  if (stock === 1) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">Critical (1)</span>;
  if (stock === 2) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">Low (2)</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-50 text-yellow-600">Low ({stock})</span>;
};

const getRowClass = (stock) => {
  if (stock === 0) return 'bg-red-50 hover:bg-red-100';
  if (stock === 1) return 'bg-orange-50 hover:bg-orange-100';
  return 'bg-yellow-50 hover:bg-yellow-100';
};

const LowStockAlertsPanel = ({ data, loading }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Icon name="AlertTriangle" size={18} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Low Stock Alerts</h2>
            <p className="text-xs text-gray-500">Items at or below minimum stock level</p>
          </div>
        </div>
        {!loading && data?.length > 0 && (
          <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-bold rounded-full">{data?.length} items</span>
        )}
      </div>
      {loading ? (
        <div className="p-6 space-y-3">
          {[1,2,3]?.map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : data?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 bg-green-100 rounded-full mb-3">
            <Icon name="CheckCircle" size={28} className="text-green-600" />
          </div>
          <p className="text-base font-semibold text-green-700">All inventory levels are healthy</p>
          <p className="text-sm text-gray-400 mt-1">No items below minimum stock levels</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Office</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID Number</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Stock</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.map((item, idx) => (
                <tr key={`${item?.id}-${idx}`} className={`transition-colors ${getRowClass(item?.currentStock)}`}>
                  <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{item?.office}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md font-medium">{item?.category}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium max-w-[200px] truncate">{item?.productName || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item?.idNumber || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-base ${
                      item?.currentStock === 0 ? 'text-red-600' :
                      item?.currentStock === 1 ? 'text-orange-600' : 'text-yellow-600'
                    }`}>{item?.currentStock}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{item?.minLevel}</td>
                  <td className="px-4 py-3">{getStatusBadge(item?.currentStock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LowStockAlertsPanel;
