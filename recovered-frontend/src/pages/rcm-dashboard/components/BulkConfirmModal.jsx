import React from 'react';
import Icon from '../../../components/AppIcon';

const ACTION_CONFIG = {
  approve: {
    title: 'Approve Requests',
    description: (count) => `Approve ${count} monthly request${count !== 1 ? 's' : ''}? Approved qty will be set to requested qty for all items.`,
    confirmLabel: 'Approve All',
    confirmClass: 'bg-green-600 hover:bg-green-700',
    icon: 'CheckCircle',
    iconClass: 'text-green-500',
  },
  reject: {
    title: 'Reject Requests',
    description: (count) => `Reject ${count} request${count !== 1 ? 's' : ''}? This action will notify the submitting offices.`,
    confirmLabel: 'Reject All',
    confirmClass: 'bg-red-600 hover:bg-red-700',
    icon: 'XCircle',
    iconClass: 'text-red-500',
    showReason: true,
  },
  review: {
    title: 'Mark Under Review',
    description: (count) => `Mark ${count} request${count !== 1 ? 's' : ''} as Under Review?`,
    confirmLabel: 'Mark Under Review',
    confirmClass: 'bg-yellow-600 hover:bg-yellow-700',
    icon: 'Eye',
    iconClass: 'text-yellow-500',
  },
};

export default function BulkConfirmModal({ action, count, rejectionReason, onReasonChange, loading, onConfirm, onCancel }) {
  const config = ACTION_CONFIG?.[action];
  if (!config) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gray-100 rounded-xl">
              <Icon name={config?.icon} size={24} className={config?.iconClass} />
            </div>
            <h2 className="text-lg font-bold text-gray-900" style={{fontFamily:'DM Sans, sans-serif'}}>
              {config?.title}
            </h2>
          </div>

          <p className="text-sm text-gray-600 mb-4">{config?.description(count)}</p>

          {config?.showReason && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Rejection Reason (applied to all)</label>
              <textarea
                value={rejectionReason}
                onChange={e => onReasonChange(e?.target?.value)}
                rows={3}
                placeholder="Enter reason for rejection..."
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-sm font-bold text-white rounded-lg transition-colors disabled:opacity-50 ${config?.confirmClass}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Icon name="Loader" size={14} className="animate-spin" />
                Processing...
              </span>
            ) : config?.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
