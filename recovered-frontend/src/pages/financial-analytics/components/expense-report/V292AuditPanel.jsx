/**
 * V292AuditPanel — READ-ONLY live classification audit for office-to-3526 funding transfers.
 * This component runs live Supabase queries A, B, C, D and displays results.
 * DO NOT PATCH. DO NOT CHANGE DATA. READ-ONLY AUDIT ONLY.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { isWFDirectOperatingExpense, isInternalFundingTransfer } from '../../../../services/expenseReportService';

// ── DATE RANGES ───────────────────────────────────────────────────────────────
function getDateRanges() {
  const now = new Date();
  const y = now?.getFullYear();
  const m = now?.getMonth();

  // Last Month
  const lastMonthStart = new Date(y, m - 1, 1)?.toISOString()?.slice(0, 10);
  const lastMonthEnd = new Date(y, m, 0)?.toISOString()?.slice(0, 10);

  // This Year
  const thisYearStart = `${y}-01-01`;
  const thisYearEnd = now?.toISOString()?.slice(0, 10);

  // Last 12 months
  const last12Start = new Date(y, m - 12, 1)?.toISOString()?.slice(0, 10);
  const last12End = now?.toISOString()?.slice(0, 10);

  return { lastMonthStart, lastMonthEnd, thisYearStart, thisYearEnd, last12Start, last12End };
}

const MAIN_ACCOUNTS = ['3526', '6093', '8124', '7975'];
const OFFICE_ACCOUNTS = ['6093', '8124', '7975'];
const EFT_ACCOUNTS = ['4083', '9976', '4416', '0538'];

const TRANSFER_KEYWORDS = [
  'transfer', 'online transfer', 'account transfer', 'xfer', '3526',
  'funding', 'reimbursement', 'internal', 'main', 'payroll', 'amex',
  '6093', '8124', '7975', 'barnegat', 'brick', 'staten',
];

const EXCLUDED_CLASSIFICATIONS = [
  'internal_transfer', 'transfer_out_internal', 'eft_clearing',
  'deposit', 'transfer_in', 'payroll_funding', 'liability_payment_to_amex',
  'amex_bill_payment', 'liability_payment_amex',
];

function classifyRow(r) {
  const meta = r?.allocation_metadata || {};
  const wfCls = (meta?.wf_classification || '')?.toLowerCase();
  const direction = (meta?.direction || meta?.transaction_type || '')?.toLowerCase();
  const excluded = meta?.excluded_from_expense;

  const included = isWFDirectOperatingExpense(r);
  const isFundingTransfer = isInternalFundingTransfer(r);

  let reason = '';
  if (wfCls === 'internal_transfer' || wfCls === 'transfer_out_internal' || wfCls === 'eft_clearing') {
    reason = `wf_classification = '${wfCls}' → excluded (internal transfer)`;
  } else if (wfCls === 'deposit' || wfCls === 'transfer_in') {
    reason = `wf_classification = '${wfCls}' → excluded (inflow/deposit)`;
  } else if (wfCls === 'payroll_funding') {
    reason = `wf_classification = 'payroll_funding' → excluded (WF→Gusto funding, Gusto already counted)`;
  } else if (wfCls === 'liability_payment_to_amex' || wfCls === 'amex_bill_payment' || wfCls === 'liability_payment_amex') {
    reason = `wf_classification = '${wfCls}' → excluded (WF→AmEx payment, AmEx charges already counted)`;
  } else if (isFundingTransfer && !included) {
    // V292: internal funding transfer detected by category/merchant/notes signal
    const cat = (r?.category_name || '')?.toLowerCase();
    const merchant = (r?.merchant_name || r?.vendor_name || '')?.toLowerCase();
    if (cat?.includes('internal transfer') || cat?.includes('transfer out') || cat?.includes('transfer in') || cat?.includes('account transfer') || cat?.includes('eft clearing')) {
      reason = `category_name = '${r?.category_name}' → excluded (V292 internal funding transfer — category signal)`;
    } else if (merchant?.includes('agn dental') || merchant?.includes('nu dental') || merchant?.includes('online transfer')) {
      reason = `merchant = '${r?.merchant_name || r?.vendor_name}' → excluded (V292 internal funding transfer — merchant signal)`;
    } else if (merchant?.includes('ame payment') || merchant?.includes('amex payment') || merchant?.includes('american express payment')) {
      reason = `merchant = '${r?.merchant_name || r?.vendor_name}' → excluded (V292 AmEx liability payment — merchant signal)`;
    } else {
      reason = `V292 isInternalFundingTransfer() = true → excluded (internal funding transfer or AmEx liability payment)`;
    }
  } else if (wfCls === 'needs_review' || wfCls === 'unassigned_needs_review' || wfCls === '') {
    reason = `wf_classification = '${wfCls || 'BLANK'}' → excluded (unclassified/needs review)`;
  } else if (wfCls === 'main_operating_direct_expense' || wfCls === 'corporate_shared_vendor_expense' || wfCls === 'corporate_shared_benefit_expense') {
    if (direction === 'inflow' || direction === 'credit' || direction === 'deposit' || direction === 'money_in') {
      reason = `wf_classification = '${wfCls}' BUT direction = '${direction}' → excluded (inflow)`;
    } else {
      reason = `wf_classification = '${wfCls}' + direction='${direction || 'none'}' + Math.abs(amount)>0 → INCLUDED in Total Expenses`;
    }
  } else if (excluded === true || excluded === 1 || excluded === '1' || excluded === 'true') {
    reason = `excluded_from_expense = true → excluded`;
  } else {
    reason = `wf_classification = '${wfCls || 'BLANK'}' → fallback _isMoneyOutAmount check`;
  }

  return { included, reason, wfCls, direction, excluded, isFundingTransfer };
}

function looksLikeTransferTo3526(r) {
  const haystack = [
    r?.merchant_name, r?.vendor_name, r?.notes, r?.description, r?.category_name
  ]?.filter(Boolean)?.join(' ')?.toLowerCase();
  return TRANSFER_KEYWORDS?.some(kw => haystack?.includes(kw));
}

export default function V292AuditPanel() {
  const [loading, setLoading] = useState(true);
  const [queryA, setQueryA] = useState(null);
  const [queryB, setQueryB] = useState(null);
  const [queryC, setQueryC] = useState(null);
  const [queryD, setQueryD] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    runAllQueries();
  }, []);

  async function runAllQueries() {
    try {
      setLoading(true);
      const ranges = getDateRanges();
      await Promise.all([
        runQueryA(ranges),
        runQueryB(ranges),
        runQueryC(ranges),
        runQueryD(ranges),
      ]);
    } catch (err) {
      setError(err?.message || 'Query failed');
    } finally {
      setLoading(false);
    }
  }

  // ── QUERY A: Sending-side transfers OUT from ...6093/...8124/...7975 to ...3526 ──
  async function runQueryA(ranges) {
    const results = {};

    for (const [label, start, end] of [
      ['Last Month', ranges?.lastMonthStart, ranges?.lastMonthEnd],
      ['This Year', ranges?.thisYearStart, ranges?.thisYearEnd],
      ['Last 12 Months', ranges?.last12Start, ranges?.last12End],
    ]) {
      const { data, error: qErr } = await supabase?.from('expenses')?.select(`
          id, expense_date, posted_date, amount, source_type, source_tab,
          expense_status, office_id, office_name, card_last4, merchant_name,
          vendor_name, notes, category_name, allocation_metadata
        `)?.eq('source_tab', 'Banking')?.in('card_last4', OFFICE_ACCOUNTS)?.gte('expense_date', start)?.lte('expense_date', end)?.order('expense_date', { ascending: false })?.limit(200);

      if (qErr) { results[label] = { error: qErr?.message }; continue; }

      // Filter: keyword match suggesting transfer to 3526
      const candidates = (data || [])?.filter(r => looksLikeTransferTo3526(r));

      results[label] = {
        total: data?.length || 0,
        candidates: candidates?.length,
        rows: candidates?.map(r => {
          const { included, reason, wfCls, direction, excluded } = classifyRow(r);
          return {
            id: r?.id,
            expense_date: r?.expense_date,
            posted_date: r?.posted_date,
            amount: r?.amount,
            source_type: r?.source_type,
            source_tab: r?.source_tab,
            expense_status: r?.expense_status,
            office_id: r?.office_id,
            office_name: r?.office_name,
            card_last4: r?.card_last4,
            merchant_name: r?.merchant_name,
            vendor_name: r?.vendor_name,
            notes: r?.notes,
            category_name: r?.category_name,
            wf_classification: wfCls,
            direction,
            excluded_from_expense: excluded,
            isWFDirectOperatingExpense: included,
            feedsTotalExpenses: included,
            reason,
          };
        }),
      };
    }

    setQueryA(results);
  }

  // ── QUERY B: Receiving-side deposits INTO ...3526 from office accounts ──
  async function runQueryB(ranges) {
    const results = {};

    for (const [label, start, end] of [
      ['Last Month', ranges?.lastMonthStart, ranges?.lastMonthEnd],
      ['This Year', ranges?.thisYearStart, ranges?.thisYearEnd],
      ['Last 12 Months', ranges?.last12Start, ranges?.last12End],
    ]) {
      const { data, error: qErr } = await supabase?.from('expenses')?.select(`
          id, expense_date, posted_date, amount, source_type, source_tab,
          expense_status, office_id, office_name, card_last4, merchant_name,
          vendor_name, notes, category_name, allocation_metadata
        `)?.eq('source_tab', 'Banking')?.eq('card_last4', '3526')?.gte('expense_date', start)?.lte('expense_date', end)?.order('expense_date', { ascending: false })?.limit(200);

      if (qErr) { results[label] = { error: qErr?.message }; continue; }

      const candidates = (data || [])?.filter(r => looksLikeTransferTo3526(r));

      results[label] = {
        total: data?.length || 0,
        candidates: candidates?.length,
        rows: candidates?.map(r => {
          const { included, reason, wfCls, direction, excluded } = classifyRow(r);
          return {
            id: r?.id,
            expense_date: r?.expense_date,
            posted_date: r?.posted_date,
            amount: r?.amount,
            source_type: r?.source_type,
            source_tab: r?.source_tab,
            expense_status: r?.expense_status,
            office_id: r?.office_id,
            office_name: r?.office_name,
            card_last4: r?.card_last4,
            merchant_name: r?.merchant_name,
            vendor_name: r?.vendor_name,
            notes: r?.notes,
            category_name: r?.category_name,
            wf_classification: wfCls,
            direction,
            excluded_from_expense: excluded,
            isWFDirectOperatingExpense: included,
            feedsTotalExpenses: included,
            reason,
          };
        }),
      };
    }

    setQueryB(results);
  }

  // ── QUERY C: Unclassified risky WF Banking rows ──
  async function runQueryC(ranges) {
    const results = {};

    for (const [label, start, end] of [
      ['Last Month', ranges?.lastMonthStart, ranges?.lastMonthEnd],
      ['This Year', ranges?.thisYearStart, ranges?.thisYearEnd],
    ]) {
      const { data, error: qErr } = await supabase?.from('expenses')?.select(`
          id, expense_date, posted_date, amount, source_type, source_tab,
          expense_status, office_id, office_name, card_last4, merchant_name,
          vendor_name, notes, category_name, allocation_metadata
        `)?.eq('source_tab', 'Banking')?.in('card_last4', MAIN_ACCOUNTS)?.eq('expense_status', 'posted')?.gte('expense_date', start)?.lte('expense_date', end)?.order('expense_date', { ascending: false })?.limit(500);

      if (qErr) { results[label] = { error: qErr?.message }; continue; }

      const allRows = data || [];

      // Filter: unclassified/risky rows
      const riskyRows = allRows?.filter(r => {
        const meta = r?.allocation_metadata || {};
        const wfCls = (meta?.wf_classification || '')?.toLowerCase();
        return (
          !wfCls ||
          wfCls === 'needs_review' ||
          wfCls === 'unassigned_needs_review'
        ) && Math.abs(parseFloat(r?.amount) || 0) > 0;
      });

      // Group by account/office/merchant/direction/amount sign/category
      const grouped = {};
      riskyRows?.forEach(r => {
        const key = `${r?.card_last4}|${r?.office_name || 'Unknown'}|${r?.merchant_name || r?.vendor_name || 'Unknown'}|${(r?.allocation_metadata?.direction || 'no-dir')}|${parseFloat(r?.amount) >= 0 ? 'positive' : 'negative'}|${r?.category_name || 'no-cat'}`;
        if (!grouped?.[key]) grouped[key] = { rows: [], totalAmt: 0 };
        grouped?.[key]?.rows?.push(r);
        grouped[key].totalAmt += Math.abs(parseFloat(r?.amount) || 0);
      });

      // Top 20 by absolute amount
      const top20 = [...riskyRows]?.sort((a, b) => Math.abs(parseFloat(b?.amount) || 0) - Math.abs(parseFloat(a?.amount) || 0))?.slice(0, 20)?.map(r => {
          const { included, reason, wfCls, direction } = classifyRow(r);
          const haystack = [r?.merchant_name, r?.vendor_name, r?.notes, r?.category_name]?.filter(Boolean)?.join(' ')?.toLowerCase();
          const looksLikeTransfer = TRANSFER_KEYWORDS?.some(kw => haystack?.includes(kw));
          const looksLikeRent = haystack?.includes('rent') || haystack?.includes('lease') || haystack?.includes('occupancy');
          const looksLikeAmexPayment = haystack?.includes('amex') || haystack?.includes('american express');
          const looksLikePayrollFunding = haystack?.includes('gusto') || haystack?.includes('payroll') || haystack?.includes('eftps');
          return {
            id: r?.id,
            expense_date: r?.expense_date,
            amount: r?.amount,
            card_last4: r?.card_last4,
            office_name: r?.office_name,
            merchant_name: r?.merchant_name,
            vendor_name: r?.vendor_name,
            notes: r?.notes,
            category_name: r?.category_name,
            wf_classification: wfCls,
            direction,
            isWFDirectOperatingExpense: included,
            feedsTotalExpenses: included,
            reason,
            looksLikeTransfer,
            looksLikeRent,
            looksLikeAmexPayment,
            looksLikePayrollFunding,
          };
        });

      const totalIncluded = riskyRows?.filter(r => isWFDirectOperatingExpense(r))?.length;
      const totalExcluded = riskyRows?.length - totalIncluded;
      const totalAmt = riskyRows?.reduce((s, r) => s + Math.abs(parseFloat(r?.amount) || 0), 0);
      const includedAmt = riskyRows?.filter(r => isWFDirectOperatingExpense(r))?.reduce((s, r) => s + Math.abs(parseFloat(r?.amount) || 0), 0);

      // By account
      const byAccount = {};
      riskyRows?.forEach(r => {
        const acct = r?.card_last4 || 'unknown';
        if (!byAccount?.[acct]) byAccount[acct] = { count: 0, totalAmt: 0, office: r?.office_name };
        byAccount[acct].count++;
        byAccount[acct].totalAmt += Math.abs(parseFloat(r?.amount) || 0);
      });

      results[label] = {
        totalPostedBankingRows: allRows?.length,
        riskyUnclassifiedCount: riskyRows?.length,
        riskyUnclassifiedTotalAmt: totalAmt,
        includedCount: totalIncluded,
        excludedCount: totalExcluded,
        includedAmt,
        byAccount,
        top20,
      };
    }

    setQueryC(results);
  }

  // ── QUERY D: Excluded transfer totals by classification ──
  async function runQueryD(ranges) {
    const results = {};

    for (const [label, start, end] of [
      ['Last Month', ranges?.lastMonthStart, ranges?.lastMonthEnd],
      ['This Year', ranges?.thisYearStart, ranges?.thisYearEnd],
    ]) {
      const { data, error: qErr } = await supabase?.from('expenses')?.select(`
          id, expense_date, amount, source_tab, card_last4, office_name,
          merchant_name, vendor_name, notes, category_name, allocation_metadata, expense_status
        `)?.eq('source_tab', 'Banking')?.in('card_last4', MAIN_ACCOUNTS)?.gte('expense_date', start)?.lte('expense_date', end)?.limit(2000);

      if (qErr) { results[label] = { error: qErr?.message }; continue; }

      const allRows = data || [];
      const totals = {};

      allRows?.forEach(r => {
        const meta = r?.allocation_metadata || {};
        const wfCls = (meta?.wf_classification || '')?.toLowerCase() || 'blank/unclassified';
        const amt = Math.abs(parseFloat(r?.amount) || 0);
        if (!totals?.[wfCls]) totals[wfCls] = { count: 0, totalAmt: 0 };
        totals[wfCls].count++;
        totals[wfCls].totalAmt += amt;
      });

      // Identify office-to-3526 candidates by keyword
      const office3526Candidates = allRows?.filter(r => {
        const haystack = [r?.merchant_name, r?.vendor_name, r?.notes, r?.category_name]?.filter(Boolean)?.join(' ')?.toLowerCase();
        const isFromOfficeAcct = OFFICE_ACCOUNTS?.includes(r?.card_last4);
        const isTo3526 = TRANSFER_KEYWORDS?.some(kw => haystack?.includes(kw));
        const isReceiving3526 = r?.card_last4 === '3526' && TRANSFER_KEYWORDS?.some(kw => haystack?.includes(kw));
        return (isFromOfficeAcct && isTo3526) || isReceiving3526;
      });

      const office3526ByOffice = {};
      office3526Candidates?.forEach(r => {
        const office = r?.office_name || `acct-${r?.card_last4}`;
        if (!office3526ByOffice?.[office]) office3526ByOffice[office] = { count: 0, totalAmt: 0 };
        office3526ByOffice[office].count++;
        office3526ByOffice[office].totalAmt += Math.abs(parseFloat(r?.amount) || 0);
      });

      results[label] = {
        totalRows: allRows?.length,
        classificationTotals: totals,
        office3526CandidateCount: office3526Candidates?.length,
        office3526CandidateTotalAmt: office3526Candidates?.reduce((s, r) => s + Math.abs(parseFloat(r?.amount) || 0), 0),
        office3526ByOffice,
      };
    }

    setQueryD(results);
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  const fmt = (n) => typeof n === 'number' ? `$${n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
  const fmtDate = (d) => d || '—';

  if (loading) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full" />
          <span className="text-yellow-800 font-medium">Running V292 live classification audit queries A, B, C, D…</span>
        </div>
        <p className="text-yellow-700 text-sm mt-2">Read-only. No data changes. No schema changes.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 font-semibold">Audit query error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-bold text-blue-900">V292 — Office-to-3526 Funding Transfer Live Classification Audit</h2>
        <p className="text-blue-700 text-sm mt-1">Read-only. No data changes. No schema changes. No launch/deploy.</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-blue-800">
          <div>Main WF accounts checked: 3526 (Eatontown), 6093 (Barnegat), 8124 (Brick), 7975 (Staten Island)</div>
          <div>EFT accounts (excluded from main account set): 4083, 9976, 4416, 0538</div>
        </div>
      </div>
      {/* QUERY A */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3">
          <h3 className="font-semibold">Query A — Sending-Side Transfers OUT from ...6093 / ...8124 / ...7975 to ...3526</h3>
          <p className="text-gray-300 text-xs mt-1">source_tab=Banking, card_last4 IN (6093,8124,7975), keyword match suggesting transfer to 3526</p>
        </div>
        <div className="p-4 space-y-6">
          {queryA && Object.entries(queryA)?.map(([period, data]) => (
            <div key={period}>
              <h4 className="font-semibold text-gray-800 mb-2">{period}</h4>
              {data?.error ? (
                <p className="text-red-600 text-sm">Error: {data?.error}</p>
              ) : (
                <>
                  <div className="flex gap-4 text-sm mb-3">
                    <span className="bg-gray-100 px-2 py-1 rounded">Total Banking rows from office accounts: <strong>{data?.total}</strong></span>
                    <span className="bg-orange-100 px-2 py-1 rounded">Transfer keyword candidates: <strong>{data?.candidates}</strong></span>
                  </div>
                  {data?.rows?.length === 0 ? (
                    <p className="text-green-700 text-sm bg-green-50 p-2 rounded">✅ No keyword-matching transfer candidates found for {period}.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border px-2 py-1 text-left">Date</th>
                            <th className="border px-2 py-1 text-left">Amount</th>
                            <th className="border px-2 py-1 text-left">Acct</th>
                            <th className="border px-2 py-1 text-left">Office</th>
                            <th className="border px-2 py-1 text-left">Status</th>
                            <th className="border px-2 py-1 text-left">Merchant/Vendor</th>
                            <th className="border px-2 py-1 text-left">Notes</th>
                            <th className="border px-2 py-1 text-left">Category</th>
                            <th className="border px-2 py-1 text-left">wf_classification</th>
                            <th className="border px-2 py-1 text-left">direction</th>
                            <th className="border px-2 py-1 text-left">excluded_from_expense</th>
                            <th className="border px-2 py-1 text-left">Feeds Total Expenses?</th>
                            <th className="border px-2 py-1 text-left">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.rows?.map((r, i) => (
                            <tr key={r?.id || i} className={r?.feedsTotalExpenses ? 'bg-red-50' : 'bg-green-50'}>
                              <td className="border px-2 py-1">{fmtDate(r?.expense_date)}</td>
                              <td className="border px-2 py-1 font-mono">{r?.amount}</td>
                              <td className="border px-2 py-1 font-mono">...{r?.card_last4}</td>
                              <td className="border px-2 py-1">{r?.office_name || '—'}</td>
                              <td className="border px-2 py-1">{r?.expense_status}</td>
                              <td className="border px-2 py-1">{r?.merchant_name || r?.vendor_name || '—'}</td>
                              <td className="border px-2 py-1 max-w-xs truncate">{r?.notes || '—'}</td>
                              <td className="border px-2 py-1">{r?.category_name || '—'}</td>
                              <td className="border px-2 py-1 font-mono text-xs">{r?.wf_classification || 'BLANK'}</td>
                              <td className="border px-2 py-1">{r?.direction || '—'}</td>
                              <td className="border px-2 py-1">{String(r?.excluded_from_expense ?? '—')}</td>
                              <td className="border px-2 py-1">
                                <span className={r?.feedsTotalExpenses ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}>
                                  {r?.feedsTotalExpenses ? '⚠️ YES — INCLUDED' : '✅ NO — EXCLUDED'}
                                </span>
                              </td>
                              <td className="border px-2 py-1 text-xs max-w-sm">{r?.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>
      {/* QUERY B */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3">
          <h3 className="font-semibold">Query B — Receiving-Side Deposits INTO ...3526 from Office Accounts</h3>
          <p className="text-gray-300 text-xs mt-1">source_tab=Banking, card_last4=3526, keyword match suggesting deposit from 6093/8124/7975</p>
        </div>
        <div className="p-4 space-y-6">
          {queryB && Object.entries(queryB)?.map(([period, data]) => (
            <div key={period}>
              <h4 className="font-semibold text-gray-800 mb-2">{period}</h4>
              {data?.error ? (
                <p className="text-red-600 text-sm">Error: {data?.error}</p>
              ) : (
                <>
                  <div className="flex gap-4 text-sm mb-3">
                    <span className="bg-gray-100 px-2 py-1 rounded">Total ...3526 Banking rows: <strong>{data?.total}</strong></span>
                    <span className="bg-orange-100 px-2 py-1 rounded">Transfer keyword candidates: <strong>{data?.candidates}</strong></span>
                  </div>
                  {data?.rows?.length === 0 ? (
                    <p className="text-green-700 text-sm bg-green-50 p-2 rounded">✅ No keyword-matching receiving-side deposit candidates found for {period}.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border px-2 py-1 text-left">Date</th>
                            <th className="border px-2 py-1 text-left">Amount</th>
                            <th className="border px-2 py-1 text-left">Acct</th>
                            <th className="border px-2 py-1 text-left">Office</th>
                            <th className="border px-2 py-1 text-left">Status</th>
                            <th className="border px-2 py-1 text-left">Merchant/Vendor</th>
                            <th className="border px-2 py-1 text-left">Notes</th>
                            <th className="border px-2 py-1 text-left">Category</th>
                            <th className="border px-2 py-1 text-left">wf_classification</th>
                            <th className="border px-2 py-1 text-left">direction</th>
                            <th className="border px-2 py-1 text-left">excluded_from_expense</th>
                            <th className="border px-2 py-1 text-left">Feeds Total Expenses?</th>
                            <th className="border px-2 py-1 text-left">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.rows?.map((r, i) => (
                            <tr key={r?.id || i} className={r?.feedsTotalExpenses ? 'bg-red-50' : 'bg-green-50'}>
                              <td className="border px-2 py-1">{fmtDate(r?.expense_date)}</td>
                              <td className="border px-2 py-1 font-mono">{r?.amount}</td>
                              <td className="border px-2 py-1 font-mono">...{r?.card_last4}</td>
                              <td className="border px-2 py-1">{r?.office_name || '—'}</td>
                              <td className="border px-2 py-1">{r?.expense_status}</td>
                              <td className="border px-2 py-1">{r?.merchant_name || r?.vendor_name || '—'}</td>
                              <td className="border px-2 py-1 max-w-xs truncate">{r?.notes || '—'}</td>
                              <td className="border px-2 py-1">{r?.category_name || '—'}</td>
                              <td className="border px-2 py-1 font-mono text-xs">{r?.wf_classification || 'BLANK'}</td>
                              <td className="border px-2 py-1">{r?.direction || '—'}</td>
                              <td className="border px-2 py-1">{String(r?.excluded_from_expense ?? '—')}</td>
                              <td className="border px-2 py-1">
                                <span className={r?.feedsTotalExpenses ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}>
                                  {r?.feedsTotalExpenses ? '⚠️ YES — INCLUDED' : '✅ NO — EXCLUDED'}
                                </span>
                              </td>
                              <td className="border px-2 py-1 text-xs max-w-sm">{r?.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>
      {/* QUERY C */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3">
          <h3 className="font-semibold">Query C — Unclassified / Risky WF Banking Rows (All 4 Main Accounts)</h3>
          <p className="text-gray-300 text-xs mt-1">source_tab=Banking, card_last4 IN (3526,6093,8124,7975), expense_status=posted, wf_classification blank/needs_review/unassigned_needs_review</p>
        </div>
        <div className="p-4 space-y-6">
          {queryC && Object.entries(queryC)?.map(([period, data]) => (
            <div key={period}>
              <h4 className="font-semibold text-gray-800 mb-2">{period}</h4>
              {data?.error ? (
                <p className="text-red-600 text-sm">Error: {data?.error}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-gray-50 border rounded p-3">
                      <div className="text-xs text-gray-500">Total Posted Banking Rows</div>
                      <div className="text-xl font-bold">{data?.totalPostedBankingRows}</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded p-3">
                      <div className="text-xs text-orange-600">Risky Unclassified Count</div>
                      <div className="text-xl font-bold text-orange-700">{data?.riskyUnclassifiedCount}</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded p-3">
                      <div className="text-xs text-orange-600">Risky Unclassified Total Amt</div>
                      <div className="text-xl font-bold text-orange-700">{fmt(data?.riskyUnclassifiedTotalAmt)}</div>
                    </div>
                    <div className={`border rounded p-3 ${data?.includedCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <div className={`text-xs ${data?.includedCount > 0 ? 'text-red-600' : 'text-green-600'}`}>Currently Included in Total Expenses</div>
                      <div className={`text-xl font-bold ${data?.includedCount > 0 ? 'text-red-700' : 'text-green-700'}`}>{data?.includedCount} rows / {fmt(data?.includedAmt)}</div>
                    </div>
                  </div>

                  {/* By Account */}
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">By Account</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(data?.byAccount || {})?.map(([acct, info]) => (
                        <div key={acct} className="bg-gray-50 border rounded p-2 text-xs">
                          <div className="font-mono font-bold">...{acct}</div>
                          <div className="text-gray-600">{info?.office || 'Unknown office'}</div>
                          <div>{info?.count} rows / {fmt(info?.totalAmt)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top 20 */}
                  {data?.top20?.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">Top 20 Risky Rows by Absolute Amount</h5>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border px-2 py-1 text-left">Date</th>
                              <th className="border px-2 py-1 text-left">Amount</th>
                              <th className="border px-2 py-1 text-left">Acct</th>
                              <th className="border px-2 py-1 text-left">Office</th>
                              <th className="border px-2 py-1 text-left">Merchant/Vendor</th>
                              <th className="border px-2 py-1 text-left">Notes</th>
                              <th className="border px-2 py-1 text-left">Category</th>
                              <th className="border px-2 py-1 text-left">wf_cls</th>
                              <th className="border px-2 py-1 text-left">dir</th>
                              <th className="border px-2 py-1 text-left">Feeds Total?</th>
                              <th className="border px-2 py-1 text-left">Looks Like</th>
                              <th className="border px-2 py-1 text-left">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data?.top20?.map((r, i) => (
                              <tr key={r?.id || i} className={r?.feedsTotalExpenses ? 'bg-red-50' : 'bg-gray-50'}>
                                <td className="border px-2 py-1">{fmtDate(r?.expense_date)}</td>
                                <td className="border px-2 py-1 font-mono">{r?.amount}</td>
                                <td className="border px-2 py-1 font-mono">...{r?.card_last4}</td>
                                <td className="border px-2 py-1">{r?.office_name || '—'}</td>
                                <td className="border px-2 py-1">{r?.merchant_name || r?.vendor_name || '—'}</td>
                                <td className="border px-2 py-1 max-w-xs truncate">{r?.notes || '—'}</td>
                                <td className="border px-2 py-1">{r?.category_name || '—'}</td>
                                <td className="border px-2 py-1 font-mono text-xs">{r?.wf_classification || 'BLANK'}</td>
                                <td className="border px-2 py-1">{r?.direction || '—'}</td>
                                <td className="border px-2 py-1">
                                  <span className={r?.feedsTotalExpenses ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}>
                                    {r?.feedsTotalExpenses ? '⚠️ YES' : '✅ NO'}
                                  </span>
                                </td>
                                <td className="border px-2 py-1 text-xs">
                                  {r?.looksLikeTransfer && <span className="bg-orange-100 text-orange-700 px-1 rounded mr-1">Transfer</span>}
                                  {r?.looksLikeRent && <span className="bg-blue-100 text-blue-700 px-1 rounded mr-1">Rent</span>}
                                  {r?.looksLikeAmexPayment && <span className="bg-purple-100 text-purple-700 px-1 rounded mr-1">AmEx Pmt</span>}
                                  {r?.looksLikePayrollFunding && <span className="bg-yellow-100 text-yellow-700 px-1 rounded mr-1">Payroll</span>}
                                  {!r?.looksLikeTransfer && !r?.looksLikeRent && !r?.looksLikeAmexPayment && !r?.looksLikePayrollFunding && <span className="text-gray-400">Unknown</span>}
                                </td>
                                <td className="border px-2 py-1 text-xs max-w-sm">{r?.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>
      {/* QUERY D */}
      <section className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-3">
          <h3 className="font-semibold">Query D — Excluded Transfer Totals by Classification</h3>
          <p className="text-gray-300 text-xs mt-1">All WF Banking rows from 4 main accounts, grouped by wf_classification, Last Month and This Year</p>
        </div>
        <div className="p-4 space-y-6">
          {queryD && Object.entries(queryD)?.map(([period, data]) => (
            <div key={period}>
              <h4 className="font-semibold text-gray-800 mb-2">{period} — Total Banking rows: {data?.totalRows}</h4>
              {data?.error ? (
                <p className="text-red-600 text-sm">Error: {data?.error}</p>
              ) : (
                <>
                  <div className="overflow-x-auto mb-4">
                    <table className="min-w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border px-2 py-1 text-left">wf_classification</th>
                          <th className="border px-2 py-1 text-right">Row Count</th>
                          <th className="border px-2 py-1 text-right">Total Abs Amount</th>
                          <th className="border px-2 py-1 text-left">Feeds Total Expenses?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data?.classificationTotals || {})?.sort((a, b) => b?.[1]?.totalAmt - a?.[1]?.totalAmt)?.map(([cls, info]) => {
                            const isExcluded = EXCLUDED_CLASSIFICATIONS?.includes(cls) || cls === 'blank/unclassified';
                            const isIncluded = ['main_operating_direct_expense', 'corporate_shared_vendor_expense', 'corporate_shared_benefit_expense']?.includes(cls);
                            return (
                              <tr key={cls} className={isIncluded ? 'bg-blue-50' : isExcluded ? 'bg-green-50' : 'bg-orange-50'}>
                                <td className="border px-2 py-1 font-mono">{cls}</td>
                                <td className="border px-2 py-1 text-right">{info?.count}</td>
                                <td className="border px-2 py-1 text-right font-mono">{fmt(info?.totalAmt)}</td>
                                <td className="border px-2 py-1">
                                  {isIncluded ? (
                                    <span className="text-blue-700 font-bold">✅ YES (direct operating expense)</span>
                                  ) : isExcluded ? (
                                    <span className="text-green-700">✅ NO — excluded by classification</span>
                                  ) : (
                                    <span className="text-orange-700 font-bold">⚠️ DEPENDS — check direction/amount sign</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Office-to-3526 candidates */}
                  <div className={`p-3 rounded border ${data?.office3526CandidateCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                    <h5 className="text-sm font-semibold mb-2">
                      Office-to-3526 Keyword Candidates: {data?.office3526CandidateCount} rows / {fmt(data?.office3526CandidateTotalAmt)}
                    </h5>
                    {data?.office3526CandidateCount === 0 ? (
                      <p className="text-green-700 text-sm">✅ No office-to-3526 keyword candidates found for {period}.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(data?.office3526ByOffice || {})?.map(([office, info]) => (
                          <div key={office} className="bg-white border rounded p-2 text-xs">
                            <div className="font-semibold">{office}</div>
                            <div>{info?.count} rows / {fmt(info?.totalAmt)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
      {/* Footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-600">
        <p className="font-semibold mb-1">V292 Audit Notes:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Red rows = currently INCLUDED in Total Verified Operating Expenses (potential risk if they are office-to-3526 transfers)</li>
          <li>Green rows = currently EXCLUDED from Total Verified Operating Expenses (correct for transfers)</li>
          <li>isWFDirectOperatingExpense() is the V290/V291 strict helper used for KPI totals</li>
          <li>Rows with blank wf_classification are excluded by isWFDirectOperatingExpense() (returns false for empty/needs_review)</li>
          <li>No data was changed. No schema was changed. No launch/deploy triggered.</li>
        </ul>
      </div>
    </div>
  );
}
