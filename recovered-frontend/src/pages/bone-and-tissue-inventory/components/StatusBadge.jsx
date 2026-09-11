import React from 'react';

const STATUS_CONFIG = {
  'In Stock': { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  'Used':     { cls: 'bg-blue-100 text-blue-800 border-blue-200',         dot: 'bg-blue-500' },
  'Wasted':   { cls: 'bg-orange-100 text-orange-800 border-orange-200',   dot: 'bg-orange-500' },
  'Returned': { cls: 'bg-gray-100 text-gray-700 border-gray-200',         dot: 'bg-gray-400' },
  'Expired':  { cls: 'bg-red-100 text-red-800 border-red-200',            dot: 'bg-red-500' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG?.[status] || STATUS_CONFIG?.['In Stock'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg?.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
      {status}
    </span>
  );
};

export default StatusBadge;
