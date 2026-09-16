import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(val || 0);

const DeltaBadge = ({ delta, isCount = false }) => {
  const val = parseFloat(delta) || 0;
  if (val === 0) return <span className="text-xs text-muted-foreground font-medium">—</span>;
  const positive = val > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
      positive ? 'text-success' : 'text-destructive'
    }`}>
      <Icon name={positive ? 'TrendingUp' : 'TrendingDown'} size={10} />
      {positive ? '+' : ''}{isCount ? val : formatCurrency(val)}
    </span>
  );
};

const DiscrepancyFlag = ({ type, message }) => {
  const styles = {
    duplicate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    missing: 'bg-destructive/10 text-destructive border-destructive/20',
    mismatch: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  };
  const icons = { duplicate: 'Copy', missing: 'AlertCircle', mismatch: 'AlertTriangle' };
  return (
    <div className={`flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs ${styles?.[type] || styles?.mismatch}`}>
      <Icon name={icons?.[type] || 'AlertTriangle'} size={11} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
};

const ReconciliationPanel = ({ preSnapshot, postSnapshot, importResult, csvRows }) => {
  const [activeTab, setActiveTab] = useState('office'); // office | date | flags

  if (!preSnapshot || !postSnapshot) return null;

  // ── Build per-office reconciliation ──────────────────────────────────────
  const allOffices = new Set([
    ...Object.keys(preSnapshot?.byOffice || {}),
    ...Object.keys(postSnapshot?.byOffice || {}),
  ]);

  const officeRows = Array.from(allOffices)?.map((officeName) => {
    const pre = preSnapshot?.byOffice?.[officeName] || { production: 0, collection: 0, expenses: 0, rowCount: 0 };
    const post = postSnapshot?.byOffice?.[officeName] || { production: 0, collection: 0, expenses: 0, rowCount: 0 };
    const importedForOffice = importResult?.officeBreakdown?.[officeName];
    const deltaProduction = (post?.production || 0) - (pre?.production || 0);
    const deltaCollection = (post?.collection || 0) - (pre?.collection || 0);
    const deltaRows = (post?.rowCount || 0) - (pre?.rowCount || 0);
    const expectedDelta = importedForOffice?.inserted || 0;

    // Flag: row count delta doesn't match expected import count
    const rowCountMismatch = importedForOffice && Math.abs(deltaRows - expectedDelta) > 0;

    // Flag: production didn't change despite import
    const noProductionChange = importedForOffice && deltaProduction === 0 && (importedForOffice?.inserted || 0) > 0;

    return {
      officeName,
      pre,
      post,
      deltaProduction,
      deltaCollection,
      deltaRows,
      expectedDelta,
      rowCountMismatch,
      noProductionChange,
      hasFlags: rowCountMismatch || noProductionChange,
    };
  });

  // ── Build per-date reconciliation ────────────────────────────────────────
  const allDates = new Set([
    ...Object.keys(preSnapshot?.byDate || {}),
    ...Object.keys(postSnapshot?.byDate || {}),
  ]);

  const dateRows = Array.from(allDates)?.sort()?.map((date) => {
    const pre = preSnapshot?.byDate?.[date] || { production: 0, collection: 0, rowCount: 0 };
    const post = postSnapshot?.byDate?.[date] || { production: 0, collection: 0, rowCount: 0 };
    const deltaProduction = (post?.production || 0) - (pre?.production || 0);
    const deltaCollection = (post?.collection || 0) - (pre?.collection || 0);
    const deltaRows = (post?.rowCount || 0) - (pre?.rowCount || 0);

    // CSV rows for this date
    const csvForDate = (csvRows || [])?.filter((r) => r?._parsedDate === date && r?._status !== 'error');
    const csvProduction = csvForDate?.reduce((s, r) => s + (parseFloat(r?.production_amount) || 0), 0);

    // Updates replace an existing value; repeated identities use the final CSV row.
    const finalEntries = new Map(csvForDate.map((row) => [
      JSON.stringify([row?._resolvedOfficeId, date, row?._providerName || '']), row,
    ]));
    const expectedProductionDelta = [...finalEntries].reduce((total, [key, row]) =>
      total + (parseFloat(row?.production_amount) || 0) - (preSnapshot?.byEntry?.[key]?.production || 0), 0);
    const productionMismatch = csvForDate?.length > 0 && Math.abs(deltaProduction - expectedProductionDelta) > 0.01;

    // Flag: date in post but not in pre (new date added)
    const isNewDate = !preSnapshot?.byDate?.[date];

    return {
      date,
      pre,
      post,
      deltaProduction,
      deltaCollection,
      deltaRows,
      csvProduction,
      productionMismatch,
      isNewDate,
      hasFlags: productionMismatch,
    };
  });

  // ── Detect potential duplicates ───────────────────────────────────────────
  const duplicateFlags = [];
  if (csvRows?.length > 0) {
    const seen = {};
    csvRows?.filter((r) => r?._status !== 'error')?.forEach((r) => {
        const key = `${r?._resolvedOfficeName}|${r?._parsedDate}|${(r?._providerName || '')?.toLowerCase()?.trim()}`;
        if (seen?.[key]) {
          duplicateFlags?.push({
            type: 'duplicate',
            message: `Duplicate row in CSV: ${r?._resolvedOfficeName} / ${r?._parsedDate} / ${r?._providerName}`,
          });
        } else {
          seen[key] = true;
        }
      });
  }

  // ── Detect missing entries (offices with 0 production post-import) ────────
  const missingFlags = officeRows?.filter((o) => o?.post?.production === 0 && o?.pre?.production === 0 && (importResult?.officeBreakdown?.[o?.officeName]?.inserted || 0) > 0)?.map((o) => ({
      type: 'missing',
      message: `${o?.officeName}: ${importResult?.officeBreakdown?.[o?.officeName]?.inserted} row(s) inserted but production total is still $0.00 — check production_amount values`,
    }));

  // ── Mismatch flags from office rows ──────────────────────────────────────
  const mismatchFlags = officeRows?.filter((o) => o?.rowCountMismatch)?.map((o) => ({
      type: 'mismatch',
      message: `${o?.officeName}: expected ${o?.expectedDelta} row delta, got ${o?.deltaRows} — some rows may have been skipped or merged`,
    }));

  const allFlags = [...duplicateFlags, ...missingFlags, ...mismatchFlags];
  const flagCount = allFlags?.length;

  // ── Summary totals ────────────────────────────────────────────────────────
  const totalPreProduction = Object.values(preSnapshot?.byOffice || {})?.reduce((s, o) => s + (o?.production || 0), 0);
  const totalPostProduction = Object.values(postSnapshot?.byOffice || {})?.reduce((s, o) => s + (o?.production || 0), 0);
  const totalPreCollection = Object.values(preSnapshot?.byOffice || {})?.reduce((s, o) => s + (o?.collection || 0), 0);
  const totalPostCollection = Object.values(postSnapshot?.byOffice || {})?.reduce((s, o) => s + (o?.collection || 0), 0);

  const tabs = [
    { id: 'office', label: 'By Office', icon: 'Building2', count: officeRows?.length },
    { id: 'date', label: 'By Date', icon: 'CalendarDays', count: dateRows?.length },
    { id: 'flags', label: 'Flags', icon: 'AlertTriangle', count: flagCount, alert: flagCount > 0 },
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Icon name="GitCompare" size={14} color="#6366f1" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Reconciliation Report</p>
            <p className="text-[10px] text-muted-foreground">Pre-import vs post-import comparison</p>
          </div>
        </div>
        {flagCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-xs font-semibold">
            <Icon name="AlertTriangle" size={11} />
            {flagCount} flag{flagCount !== 1 ? 's' : ''}
          </span>
        )}
        {flagCount === 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success border border-success/20 rounded-full text-xs font-semibold">
            <Icon name="CheckCircle" size={11} />
            Clean
          </span>
        )}
      </div>
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-px bg-border">
        <div className="bg-card px-4 py-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Production Δ</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-foreground">{formatCurrency(totalPostProduction - totalPreProduction)}</span>
            <span className="text-xs text-muted-foreground">{formatCurrency(totalPreProduction)} → {formatCurrency(totalPostProduction)}</span>
          </div>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Collection Δ</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-foreground">{formatCurrency(totalPostCollection - totalPreCollection)}</span>
            <span className="text-xs text-muted-foreground">{formatCurrency(totalPreCollection)} → {formatCurrency(totalPostCollection)}</span>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs?.map((tab) => (
          <button
            key={tab?.id}
            type="button"
            onClick={() => setActiveTab(tab?.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-smooth border-b-2 ${
              activeTab === tab?.id
                ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            <Icon name={tab?.icon} size={12} />
            {tab?.label}
            {tab?.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                tab?.alert
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :'bg-muted text-muted-foreground'
              }`}>
                {tab?.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div className="p-4">
        {/* By Office tab */}
        {activeTab === 'office' && (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-semibold text-muted-foreground">Office</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Pre Production</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Post Production</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Δ Production</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Pre Collection</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Post Collection</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Δ Collection</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Rows Δ</th>
                    <th className="pb-2 text-center font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {officeRows?.map((row) => (
                    <tr key={row?.officeName} className={row?.hasFlags ? 'bg-amber-500/5' : ''}>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Icon name="Building2" size={11} color="var(--color-primary)" />
                          <span className="font-medium text-foreground">{row?.officeName}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{formatCurrency(row?.pre?.production)}</td>
                      <td className="py-2 text-right font-medium text-foreground">{formatCurrency(row?.post?.production)}</td>
                      <td className="py-2 text-right"><DeltaBadge delta={row?.deltaProduction} /></td>
                      <td className="py-2 text-right text-muted-foreground">{formatCurrency(row?.pre?.collection)}</td>
                      <td className="py-2 text-right font-medium text-foreground">{formatCurrency(row?.post?.collection)}</td>
                      <td className="py-2 text-right"><DeltaBadge delta={row?.deltaCollection} /></td>
                      <td className="py-2 text-right">
                        <DeltaBadge delta={row?.deltaRows} isCount />
                      </td>
                      <td className="py-2 text-center">
                        {row?.hasFlags ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-semibold">
                            <Icon name="AlertTriangle" size={9} />Flag
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-success/10 text-success rounded-full text-[10px] font-semibold">
                            <Icon name="CheckCircle" size={9} />OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* By Date tab */}
        {activeTab === 'date' && (
          <div className="space-y-2">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Pre Production</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Post Production</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Δ Production</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">CSV Production</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Δ Collection</th>
                    <th className="pb-2 text-right font-semibold text-muted-foreground">Rows Δ</th>
                    <th className="pb-2 text-center font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {dateRows?.map((row) => (
                    <tr key={row?.date} className={row?.hasFlags ? 'bg-amber-500/5' : row?.isNewDate ? 'bg-success/5' : ''}>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <Icon name="Calendar" size={11} color={row?.isNewDate ? 'var(--color-success)' : 'var(--color-muted-foreground)'} />
                          <span className={`font-medium ${row?.isNewDate ? 'text-success' : 'text-foreground'}`}>{row?.date}</span>
                          {row?.isNewDate && (
                            <span className="px-1 py-0.5 bg-success/10 text-success rounded text-[9px] font-bold">NEW</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{formatCurrency(row?.pre?.production)}</td>
                      <td className="py-2 text-right font-medium text-foreground">{formatCurrency(row?.post?.production)}</td>
                      <td className="py-2 text-right"><DeltaBadge delta={row?.deltaProduction} /></td>
                      <td className="py-2 text-right text-muted-foreground">{formatCurrency(row?.csvProduction)}</td>
                      <td className="py-2 text-right"><DeltaBadge delta={row?.deltaCollection} /></td>
                      <td className="py-2 text-right"><DeltaBadge delta={row?.deltaRows} isCount /></td>
                      <td className="py-2 text-center">
                        {row?.hasFlags ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-semibold">
                            <Icon name="AlertTriangle" size={9} />Flag
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-success/10 text-success rounded-full text-[10px] font-semibold">
                            <Icon name="CheckCircle" size={9} />OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Flags tab */}
        {activeTab === 'flags' && (
          <div className="space-y-2">
            {allFlags?.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Icon name="ShieldCheck" size={20} color="var(--color-success)" />
                </div>
                <p className="text-sm font-semibold text-foreground">No discrepancies detected</p>
                <p className="text-xs text-muted-foreground">All pre/post totals reconcile cleanly. No duplicates or missing entries found.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  {allFlags?.length} potential issue{allFlags?.length !== 1 ? 's' : ''} detected. Review before confirming data accuracy.
                </p>
                {allFlags?.map((flag, i) => (
                  <DiscrepancyFlag key={i} type={flag?.type} message={flag?.message} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReconciliationPanel;
