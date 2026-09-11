import React from 'react';
import Icon from '../../../components/AppIcon';

export default function BulkActionsToolbar({ selectedCount, onApprove, onReject, onMarkReview, onClear }) {
  return (
    <div className="mb-4 flex items-center gap-3 bg-blue-900 text-white px-5 py-3 rounded-xl shadow-lg">
      <div className="flex items-center gap-2 flex-1">
        <Icon name="CheckSquare" size={16} className="text-blue-300" />
        <span className="text-sm font-semibold">{selectedCount} request{selectedCount !== 1 ? 's' : ''} selected</span>
      </div>
      <button
        onClick={onApprove}
        className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-400 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Icon name="CheckCircle" size={14} />
        Approve Selected
      </button>
      <button
        onClick={onReject}
        className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Icon name="XCircle" size={14} />
        Reject Selected
      </button>
      <button
        onClick={onMarkReview}
        className="flex items-center gap-1.5 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Icon name="Eye" size={14} />
        Mark Under Review
      </button>
      <button
        onClick={onClear}
        className="text-blue-300 hover:text-white transition-colors"
        title="Clear selection"
      >
        <Icon name="X" size={16} />
      </button>
    </div>
  );
}
