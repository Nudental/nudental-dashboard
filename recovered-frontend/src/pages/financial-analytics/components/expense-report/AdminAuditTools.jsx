import React, { useState, useEffect } from 'react';
import Icon from '../../../../components/AppIcon';
import {
  fetchImportBatches,
  fetchAmexRawForReview,
  fetchUnmatchedExpenses,
  fetchAmexSyncLogs,
} from '../../../../services/expenseReportService';

const fmt = (n) => {
  if (!n) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
};

const STATUS_COLORS = {
  completed: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  partial: 'bg-warning/10 text-warning',
  processing: 'bg-blue-500/10 text-blue-600',
  pending: 'bg-muted text-muted-foreground',
};

const AdminAuditTools = () => {
  const [activeTab, setActiveTab] = useState('import_log');
  const [importBatches, setImportBatches] = useState([]);
  const [unmatchedExpenses, setUnmatchedExpenses] = useState([]);
  const [reviewItems, setReviewItems] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'import_log') {
        const batches = await fetchImportBatches({ limit: 30 });
        setImportBatches(batches);
      } else if (activeTab === 'unmatched') {
        const unmatched = await fetchUnmatchedExpenses();
        setUnmatchedExpenses(unmatched);
      } else if (activeTab === 'review') {
        const items = await fetchAmexRawForReview({ needsReview: true });
        setReviewItems(items);
      } else if (activeTab === 'sync_logs') {
        const logs = await fetchAmexSyncLogs(20);
        setSyncLogs(logs);
      }
    } catch (err) {
      console.warn('[AdminAuditTools] load error:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { id: 'import_log', label: 'Import Log', icon: 'FileText' },
    { id: 'unmatched', label: 'Unmatched Records', icon: 'AlertTriangle' },
    { id: 'review', label: 'Needs Review', icon: 'Eye' },
    { id: 'sync_logs', label: 'Sync Logs', icon: 'RefreshCw' },
  ];

  return (
    <div className="bg-card border border-border rounded-xl shadow-elevation-1">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon name="Shield" size={15} className="text-primary" />
        <span className="text-sm font-semibold text-foreground">Admin Audit Tools</span>
      </div>
      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-border overflow-x-auto">
        {TABS?.map(tab => (
          <button
            key={tab?.id}
            onClick={() => setActiveTab(tab?.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              activeTab === tab?.id
                ? 'bg-primary/10 text-primary border-b-2 border-primary' :'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab?.icon} size={12} />
            {tab?.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
            <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading…
          </div>
        ) : (
          <>
            {/* Import Log */}
            {activeTab === 'import_log' && (
              <div className="overflow-x-auto">
                {importBatches?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No import batches found.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        {['Source', 'File', 'Statement Month', 'Status', 'Rows', 'Amount', 'Dupes', 'Errors', 'Imported At']?.map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importBatches?.map(b => (
                        <tr key={b?.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="px-3 py-2 text-foreground">{b?.source_type?.replace(/_/g, ' ')}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate" title={b?.import_filename}>{b?.import_filename || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground">{b?.statement_month || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS?.[b?.import_status] || 'bg-muted text-muted-foreground'}`}>
                              {b?.import_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-foreground">{b?.total_rows}</td>
                          <td className="px-3 py-2 text-foreground">{fmt(b?.total_amount)}</td>
                          <td className="px-3 py-2 text-warning">{b?.duplicate_rows || 0}</td>
                          <td className="px-3 py-2 text-destructive">{b?.rejected_rows || 0}</td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {b?.imported_at ? new Date(b.imported_at)?.toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Unmatched Records */}
            {activeTab === 'unmatched' && (
              <div>
                {unmatchedExpenses?.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-xs text-success">
                    <Icon name="CheckCircle" size={13} />
                    No unmatched expense records found.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning mb-3">
                      <Icon name="AlertTriangle" size={13} />
                      {unmatchedExpenses?.length} expense records are missing office or department assignment.
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            {['Date', 'Amount', 'Category', 'Source', 'Office', 'Department', 'Cardholder', 'Merchant']?.map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {unmatchedExpenses?.map(r => (
                            <tr key={r?.id} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="px-3 py-2 text-foreground">{r?.expense_date}</td>
                              <td className="px-3 py-2 font-semibold text-foreground">{fmt(r?.amount)}</td>
                              <td className="px-3 py-2 text-foreground">{r?.category_name || '—'}</td>
                              <td className="px-3 py-2 text-muted-foreground">{r?.source_type?.replace(/_/g, ' ')}</td>
                              <td className="px-3 py-2">
                                {r?.office_name ? (
                                  <span className="text-foreground">{r?.office_name}</span>
                                ) : (
                                  <span className="text-destructive font-medium">Missing</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {r?.department_name ? (
                                  <span className="text-foreground">{r?.department_name}</span>
                                ) : (
                                  <span className="text-warning">Unassigned</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{r?.cardholder_name || '—'}</td>
                              <td className="px-3 py-2 text-muted-foreground">{r?.merchant_name || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Needs Review */}
            {activeTab === 'review' && (
              <div>
                {reviewItems?.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-xs text-success">
                    <Icon name="CheckCircle" size={13} />
                    No AmEx transactions flagged for review.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning mb-3">
                      <Icon name="AlertTriangle" size={13} />
                      {reviewItems?.length} AmEx transactions need review (missing cardholder or other issues).
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            {['Date', 'Amount', 'Merchant', 'Cardholder', 'Card', 'Issue', 'Normalized']?.map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reviewItems?.map(r => (
                            <tr key={r?.id} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="px-3 py-2 text-foreground">{r?.transaction_date}</td>
                              <td className="px-3 py-2 font-semibold text-foreground">{fmt(r?.amount)}</td>
                              <td className="px-3 py-2 text-foreground">{r?.merchant_name || '—'}</td>
                              <td className="px-3 py-2">
                                {r?.cardholder_name ? (
                                  <span className="text-foreground">{r?.cardholder_name}</span>
                                ) : (
                                  <span className="text-destructive font-medium">Unassigned</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{r?.card_last4 ? `••••${r?.card_last4}` : '—'}</td>
                              <td className="px-3 py-2 text-warning">{r?.review_reason || 'Flagged'}</td>
                              <td className="px-3 py-2">
                                {r?.normalized_expense_id ? (
                                  <span className="text-success text-[10px]">✓ Normalized</span>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">Pending</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Sync Logs */}
            {activeTab === 'sync_logs' && (
              <div>
                {syncLogs?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No sync logs found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          {['Type', 'Status', 'Fetched', 'Imported', 'Dupes', 'Errors', 'Started', 'Completed']?.map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {syncLogs?.map(l => (
                          <tr key={l?.id} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="px-3 py-2 text-foreground">{l?.sync_type}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS?.[l?.status] || 'bg-muted text-muted-foreground'}`}>
                                {l?.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-foreground">{l?.records_fetched || 0}</td>
                            <td className="px-3 py-2 text-success">{l?.records_imported || 0}</td>
                            <td className="px-3 py-2 text-warning">{l?.duplicates_skipped || 0}</td>
                            <td className="px-3 py-2 text-destructive">{l?.errors || 0}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {l?.started_at ? new Date(l.started_at)?.toLocaleString() : '—'}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {l?.completed_at ? new Date(l.completed_at)?.toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAuditTools;
