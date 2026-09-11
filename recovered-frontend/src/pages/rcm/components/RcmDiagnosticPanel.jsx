import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { getRcmDiagnostics } from '../../../services/rcmService';

/**
 * RCM Diagnostic Panel — visible to Super Admin only.
 * Shows per-subtab source endpoint, last sync time, record counts, and errors.
 */
const SUBTAB_LABELS = {
  claims: 'Claim Submissions',
  payment_arrangements: 'Payment Arrangement',
  patient_statements: 'Patient Statements',
  pos_collections: 'POS Collections',
  adjustments: 'Adjustment',
  dashboard: 'Dashboard',
  collection_refunds: 'Collection Refund',
};

const StatusDot = ({ hasError }) => (
  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${hasError ? 'bg-red-500' : 'bg-green-500'}`} />
);

const RcmDiagnosticPanel = ({ refreshKey }) => {
  const [open, setOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState({});

  useEffect(() => {
    // Re-read diagnostics whenever refreshKey changes (after a data fetch)
    const timer = setTimeout(() => {
      setDiagnostics(getRcmDiagnostics());
    }, 500);
    return () => clearTimeout(timer);
  }, [refreshKey]);

  const subtabKeys = Object.keys(SUBTAB_LABELS);
  const errorCount = subtabKeys?.filter(k => diagnostics?.[k]?.lastError)?.length;

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 bg-card transition-colors"
      >
        <Icon name="Bug" size={13} />
        <span className="font-medium">RCM Diagnostics</span>
        {errorCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        )}
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={13} />
      </button>

      {open && (
        <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="Activity" size={15} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">RCM Data Pipeline Diagnostics</span>
              <span className="text-xs text-muted-foreground">(Super Admin only)</span>
            </div>
            <button
              onClick={() => setDiagnostics(getRcmDiagnostics())}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Icon name="RefreshCw" size={12} /> Refresh
            </button>
          </div>

          <div className="divide-y divide-border">
            {subtabKeys?.map(key => {
              const d = diagnostics?.[key];
              const hasError = !!d?.lastError;

              return (
                <div key={key} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <StatusDot hasError={hasError} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{SUBTAB_LABELS?.[key]}</span>
                        {d?.timestamp && (
                          <span className="text-[10px] text-muted-foreground">
                            Last fetch: {new Date(d?.timestamp)?.toLocaleTimeString()}
                          </span>
                        )}
                      </div>

                      {d ? (
                        <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span><span className="font-medium text-foreground">Source:</span> {d?.source || '—'}</span>
                          <span><span className="font-medium text-foreground">Date Range:</span> {d?.dateRange || '—'}</span>
                          <span><span className="font-medium text-foreground">Office:</span> {d?.officeFilter || '—'}</span>
                          <span><span className="font-medium text-foreground">Duration:</span> {d?.durationMs != null ? `${d?.durationMs}ms` : '—'}</span>
                          <span><span className="font-medium text-foreground">Fetched:</span> {d?.recordsFetched ?? '—'}</span>
                          <span><span className="font-medium text-foreground">After Dedup:</span> {d?.recordsAfterDedup ?? '—'}</span>
                          {d?.note && (
                            <span className="col-span-2 sm:col-span-4 text-amber-600">
                              <Icon name="Info" size={10} className="inline mr-1" />
                              {d?.note}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground mt-0.5">No fetch recorded yet for this session.</p>
                      )}

                      {hasError && (
                        <div className="mt-1.5 flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                          <Icon name="AlertTriangle" size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-semibold text-red-700">Last Error</p>
                            <p className="text-[11px] text-red-600 break-all">{d?.lastError}</p>
                            {d?.errors?.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {d?.errors?.map((e, i) => (
                                  <li key={i} className="text-[10px] text-red-500">
                                    {e?.office}: {e?.error}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 bg-muted/30 border-t border-border">
            <p className="text-[11px] text-muted-foreground">
              <Icon name="Info" size={11} className="inline mr-1" />
              All RCM data is sourced from <strong>Dentrix Ascend API</strong> via{' '}
              <code className="bg-muted px-1 rounded">api.nudashboard.com/v2</code>.
              Office mapping: Staten Island → 14000000000432, Eatontown → 14000000000433,
              Barnegat → 14000000000434, Brick → 14000000000435.
              Errors indicate the Dentrix endpoint is unavailable, the API key is invalid,
              or the resource is not exposed for that location.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RcmDiagnosticPanel;
