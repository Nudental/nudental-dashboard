import React, { useState, useEffect } from 'react';
import { supplyRequestService } from '../../../services/supplyRequestService';
import { sendSupplyStatusEmail } from '../../../services/rcmEmailService';
import Icon from '../../../components/AppIcon';

const PRIORITY_BADGE = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-gray-400 text-white',
};

export default function RequestDetailPanel({ batch, onClose, onRefresh }) {
  const [items, setItems] = useState([]);
  const [itemStates, setItemStates] = useState({});
  const [reviewerNotes, setReviewerNotes] = useState(batch?.reviewer_notes || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadItems();
  }, [batch?.id]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await supplyRequestService?.fetchRequestItems(batch?.id);
      setItems(data || []);
      // Initialize item states
      const states = {};
      (data || [])?.forEach(item => {
        states[item.id] = {
          action: item?.item_status === 'approved' ? 'approve' :
                  item?.item_status === 'rejected' ? 'reject' :
                  item?.item_status === 'partially_fulfilled' ? 'partial' : null,
          approvedQty: item?.approved_qty ?? item?.requested_qty ?? 0,
        };
      });
      setItemStates(states);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  };

  const setItemAction = (itemId, action, requestedQty) => {
    setItemStates(prev => ({
      ...prev,
      [itemId]: {
        action,
        approvedQty: action === 'approve' ? requestedQty :
                     action === 'reject' ? 0 :
                     prev?.[itemId]?.approvedQty ?? requestedQty,
      },
    }));
  };

  const setApprovedQty = (itemId, qty) => {
    setItemStates(prev => ({ ...prev, [itemId]: { ...prev?.[itemId], approvedQty: qty } }));
  };

  const handleApproveAll = () => {
    const states = {};
    items?.forEach(item => {
      states[item.id] = { action: 'approve', approvedQty: item?.requested_qty ?? 0 };
    });
    setItemStates(states);
  };

  const handleRejectAll = () => {
    const states = {};
    items?.forEach(item => {
      states[item.id] = { action: 'reject', approvedQty: 0 };
    });
    setItemStates(states);
  };

  const handleSaveReview = async () => {
    setSubmitting(true);
    try {
      await supplyRequestService?.updateBatchStatus(batch?.id, 'under_review', reviewerNotes);
      // Send status-change email (fire-and-forget)
      sendSupplyStatusEmail('monthly', batch?.id, 'under_review', reviewerNotes);
      await onRefresh();
      onClose();
    } catch (err) {
      setError(err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDecision = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Determine overall batch status
      const actions = Object.values(itemStates);
      const allApproved = actions?.every(s => s?.action === 'approve');
      const allRejected = actions?.every(s => s?.action === 'reject');
      const anyPartial = actions?.some(s => s?.action === 'partial');
      const anyApproved = actions?.some(s => s?.action === 'approve');

      let batchStatus = 'under_review';
      if (allApproved) batchStatus = 'approved';
      else if (allRejected) batchStatus = 'rejected';
      else if (anyPartial || (anyApproved && !allApproved)) batchStatus = 'partially_fulfilled';

      // Update each item
      await Promise.all(items?.map(item => {
        const state = itemStates?.[item?.id];
        if (!state?.action) return Promise.resolve();
        const itemStatus = state?.action === 'approve' ? 'approved' :
                           state?.action === 'reject' ? 'rejected' : 'partially_fulfilled';
        return supplyRequestService?.updateRequestItem(item?.id, {
          item_status: itemStatus,
          approved_qty: state?.approvedQty,
        });
      }));

      // Update batch
      await supplyRequestService?.updateBatchStatus(batch?.id, batchStatus, reviewerNotes);

      // Send status-change email (fire-and-forget)
      sendSupplyStatusEmail('monthly', batch?.id, batchStatus, reviewerNotes);

      await onRefresh();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-blue-50 border-t-2 border-blue-200 p-5">
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-xs text-gray-500">Office</span>
            <div className="text-sm font-semibold text-gray-800">{batch?.office_id?.replace('Nu Dental of ', '')}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Submitted By</span>
            <div className="text-sm font-semibold text-gray-800">{batch?.requested_by_profile?.full_name || '—'}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Date</span>
            <div className="text-sm text-gray-700">{batch?.created_at?.slice(0, 10)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Month</span>
            <div className="text-sm text-gray-700">{batch?.request_month || '—'}</div>
          </div>
          {batch?.requester_notes && (
            <div className="flex-1">
              <span className="text-xs text-gray-500">Requester Notes</span>
              <div className="text-sm text-gray-700 italic">{batch?.requester_notes}</div>
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
          <Icon name="X" size={18} />
        </button>
      </div>
      {/* Items Table */}
      {loading ? (
        <div className="text-center py-6 text-gray-400">
          <Icon name="Loader" size={20} className="animate-spin mx-auto mb-2" />
          Loading items...
        </div>
      ) : items?.length === 0 ? (
        <div className="text-center py-6 text-gray-400">No items found for this request.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-blue-200 mb-4">
          <table className="w-full min-w-[800px] bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Item</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Dept / Section</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">On Hand</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Req Qty</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Unit</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Priority</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Notes</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Approved Qty</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items?.map(item => {
                const state = itemStates?.[item?.id] || { action: null, approvedQty: item?.requested_qty };
                const isPartial = state?.action === 'partial';
                return (
                  <tr key={item?.id} className={`${
                    state?.action === 'approve' ? 'bg-green-50' :
                    state?.action === 'reject' ? 'bg-red-50' :
                    state?.action === 'partial' ? 'bg-orange-50' : ''
                  }`}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-800">
                      {item?.supply_items?.name || item?.item_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {item?.supply_departments?.name || '—'}
                      {item?.supply_subsections?.name ? ` / ${item?.supply_subsections?.name}` : ''}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">{item?.current_on_hand ?? '—'}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-gray-800">{item?.requested_qty}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{item?.unit_type || '—'}</td>
                    <td className="px-3 py-2">
                      {item?.priority && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${PRIORITY_BADGE?.[item?.priority] || 'bg-gray-200 text-gray-600'}`}>
                          {item?.priority}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate" title={item?.reason_notes}>
                      {item?.reason_notes || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={item?.requested_qty}
                        value={state?.approvedQty}
                        onChange={e => setApprovedQty(item?.id, Number(e?.target?.value))}
                        disabled={state?.action === 'reject' || state?.action === 'approve'}
                        className="w-16 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setItemAction(item?.id, 'approve', item?.requested_qty)}
                          className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
                            state?.action === 'approve' ?'bg-green-600 text-white' :'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => setItemAction(item?.id, 'partial', item?.requested_qty)}
                          className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
                            state?.action === 'partial' ?'bg-orange-500 text-white' :'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          }`}
                        >
                          ~ Partial
                        </button>
                        <button
                          onClick={() => setItemAction(item?.id, 'reject', item?.requested_qty)}
                          className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
                            state?.action === 'reject' ?'bg-red-600 text-white' :'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Reviewer Notes */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Reviewer Notes</label>
        <textarea
          value={reviewerNotes}
          onChange={e => setReviewerNotes(e?.target?.value)}
          rows={3}
          placeholder="Add notes for the submitting office..."
          className="w-full text-base border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          style={{fontSize:'16px'}}
        />
      </div>
      {/* Error */}
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
          <Icon name="AlertCircle" size={14} />
          {error}
        </div>
      )}
      {/* Batch Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleApproveAll}
          className="px-4 py-3 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          style={{minHeight:'52px'}}
        >
          ✓ Approve All Items
        </button>
        <button
          onClick={handleRejectAll}
          className="px-4 py-3 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          style={{minHeight:'52px'}}
        >
          ✗ Reject All
        </button>
        <button
          onClick={handleSaveReview}
          disabled={submitting}
          className="px-4 py-3 text-sm font-semibold bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
          style={{minHeight:'52px'}}
        >
          Save as Under Review
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSubmitDecision}
          disabled={submitting}
          className="px-6 py-3 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          style={{minHeight:'56px'}}
        >
          {submitting ? (
            <span className="flex items-center gap-2"><Icon name="Loader" size={14} className="animate-spin" /> Submitting...</span>
          ) : (
            'Submit Decision'
          )}
        </button>
      </div>
    </div>
  );
}
