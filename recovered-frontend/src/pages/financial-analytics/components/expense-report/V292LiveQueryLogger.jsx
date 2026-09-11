/**
 * V292LiveQueryLogger — TEMPORARY READ-ONLY console logger.
 * Runs all four V292 audit queries and logs raw JSON to console.
 * DELETE AFTER AUDIT IS COMPLETE. NO DATA CHANGES.
 */
import { useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';

function getDateRanges() {
  const now = new Date();
  const y = now?.getFullYear();
  const m = now?.getMonth();
  return {
    lastMonthStart: new Date(y, m - 1, 1)?.toISOString()?.slice(0, 10),
    lastMonthEnd: new Date(y, m, 0)?.toISOString()?.slice(0, 10),
    thisYearStart: `${y}-01-01`,
    thisYearEnd: now?.toISOString()?.slice(0, 10),
  };
}

const OFFICE_ACCOUNTS = ['6093', '8124', '7975'];
const MAIN_ACCOUNTS = ['3526', '6093', '8124', '7975'];
const TRANSFER_KEYWORDS = [
  'transfer', 'online transfer', 'account transfer', 'xfer', '3526',
  'funding', 'reimbursement', 'internal', '6093', '8124', '7975',
  'barnegat', 'brick', 'staten',
];

function looksLikeTransfer(r) {
  const h = [r?.merchant_name, r?.vendor_name, r?.notes, r?.description, r?.category_name]?.filter(Boolean)?.join(' ')?.toLowerCase();
  return TRANSFER_KEYWORDS?.some(kw => h?.includes(kw));
}

export default function V292LiveQueryLogger() {
  useEffect(() => {
    async function run() {
      const { lastMonthStart, lastMonthEnd, thisYearStart, thisYearEnd } = getDateRanges();
      console.log('[V292-LOGGER] Date ranges:', { lastMonthStart, lastMonthEnd, thisYearStart, thisYearEnd });

      // ── QUERY A: Sending-side from office accounts ──
      const { data: qA_lm, error: eA_lm } = await supabase?.from('expenses')?.select(
        'id, expense_date, posted_date, amount, source_type, source_tab, expense_status, office_id, office_name, card_last4, merchant_name, vendor_name, notes, category_name, allocation_metadata' )?.eq('source_tab', 'Banking')?.in('card_last4', OFFICE_ACCOUNTS)?.gte('expense_date', lastMonthStart)?.lte('expense_date', lastMonthEnd)?.order('expense_date', { ascending: false })?.limit(500);

      const { data: qA_ty, error: eA_ty } = await supabase?.from('expenses')?.select(
        'id, expense_date, posted_date, amount, source_type, source_tab, expense_status, office_id, office_name, card_last4, merchant_name, vendor_name, notes, category_name, allocation_metadata' )?.eq('source_tab', 'Banking')?.in('card_last4', OFFICE_ACCOUNTS)?.gte('expense_date', thisYearStart)?.lte('expense_date', thisYearEnd)?.order('expense_date', { ascending: false })?.limit(1000);

      const qA_lm_candidates = (qA_lm || [])?.filter(looksLikeTransfer);
      const qA_ty_candidates = (qA_ty || [])?.filter(looksLikeTransfer);

      console.log('[V292-QUERY-A] Last Month — total Banking rows from office accounts:', qA_lm?.length, '| error:', eA_lm?.message);
      console.log('[V292-QUERY-A] Last Month — transfer keyword candidates:', qA_lm_candidates?.length);
      console.log('[V292-QUERY-A-LM-ROWS]', JSON.stringify(qA_lm_candidates?.map(r => ({
        id: r?.id,
        expense_date: r?.expense_date,
        amount: r?.amount,
        card_last4: r?.card_last4,
        office_name: r?.office_name,
        expense_status: r?.expense_status,
        merchant_name: r?.merchant_name,
        vendor_name: r?.vendor_name,
        notes: r?.notes,
        category_name: r?.category_name,
        wf_classification: r?.allocation_metadata?.wf_classification,
        direction: r?.allocation_metadata?.direction,
        excluded_from_expense: r?.allocation_metadata?.excluded_from_expense,
      }))));

      console.log('[V292-QUERY-A] This Year — total Banking rows from office accounts:', qA_ty?.length, '| error:', eA_ty?.message);
      console.log('[V292-QUERY-A] This Year — transfer keyword candidates:', qA_ty_candidates?.length);
      console.log('[V292-QUERY-A-TY-ROWS]', JSON.stringify(qA_ty_candidates?.map(r => ({
        id: r?.id,
        expense_date: r?.expense_date,
        amount: r?.amount,
        card_last4: r?.card_last4,
        office_name: r?.office_name,
        expense_status: r?.expense_status,
        merchant_name: r?.merchant_name,
        vendor_name: r?.vendor_name,
        notes: r?.notes,
        category_name: r?.category_name,
        wf_classification: r?.allocation_metadata?.wf_classification,
        direction: r?.allocation_metadata?.direction,
        excluded_from_expense: r?.allocation_metadata?.excluded_from_expense,
      }))));

      // ── QUERY B: Receiving-side into ...3526 ──
      const { data: qB_lm, error: eB_lm } = await supabase?.from('expenses')?.select(
        'id, expense_date, posted_date, amount, source_type, source_tab, expense_status, office_id, office_name, card_last4, merchant_name, vendor_name, notes, category_name, allocation_metadata' )?.eq('source_tab', 'Banking')?.eq('card_last4', '3526')?.gte('expense_date', lastMonthStart)?.lte('expense_date', lastMonthEnd)?.order('expense_date', { ascending: false })?.limit(500);

      const { data: qB_ty, error: eB_ty } = await supabase?.from('expenses')?.select(
        'id, expense_date, posted_date, amount, source_type, source_tab, expense_status, office_id, office_name, card_last4, merchant_name, vendor_name, notes, category_name, allocation_metadata' )?.eq('source_tab', 'Banking')?.eq('card_last4', '3526')?.gte('expense_date', thisYearStart)?.lte('expense_date', thisYearEnd)?.order('expense_date', { ascending: false })?.limit(1000);

      const qB_lm_candidates = (qB_lm || [])?.filter(looksLikeTransfer);
      const qB_ty_candidates = (qB_ty || [])?.filter(looksLikeTransfer);

      console.log('[V292-QUERY-B] Last Month — total ...3526 Banking rows:', qB_lm?.length, '| error:', eB_lm?.message);
      console.log('[V292-QUERY-B] Last Month — transfer keyword candidates:', qB_lm_candidates?.length);
      console.log('[V292-QUERY-B-LM-ROWS]', JSON.stringify(qB_lm_candidates?.map(r => ({
        id: r?.id,
        expense_date: r?.expense_date,
        amount: r?.amount,
        card_last4: r?.card_last4,
        office_name: r?.office_name,
        expense_status: r?.expense_status,
        merchant_name: r?.merchant_name,
        vendor_name: r?.vendor_name,
        notes: r?.notes,
        category_name: r?.category_name,
        wf_classification: r?.allocation_metadata?.wf_classification,
        direction: r?.allocation_metadata?.direction,
        excluded_from_expense: r?.allocation_metadata?.excluded_from_expense,
      }))));

      console.log('[V292-QUERY-B] This Year — total ...3526 Banking rows:', qB_ty?.length, '| error:', eB_ty?.message);
      console.log('[V292-QUERY-B] This Year — transfer keyword candidates:', qB_ty_candidates?.length);
      console.log('[V292-QUERY-B-TY-ROWS]', JSON.stringify(qB_ty_candidates?.map(r => ({
        id: r?.id,
        expense_date: r?.expense_date,
        amount: r?.amount,
        card_last4: r?.card_last4,
        office_name: r?.office_name,
        expense_status: r?.expense_status,
        merchant_name: r?.merchant_name,
        vendor_name: r?.vendor_name,
        notes: r?.notes,
        category_name: r?.category_name,
        wf_classification: r?.allocation_metadata?.wf_classification,
        direction: r?.allocation_metadata?.direction,
        excluded_from_expense: r?.allocation_metadata?.excluded_from_expense,
      }))));

      // ── QUERY C: Unclassified risky WF Banking rows ──
      const { data: qC_lm, error: eC_lm } = await supabase?.from('expenses')?.select(
        'id, expense_date, amount, source_tab, expense_status, office_name, card_last4, merchant_name, vendor_name, notes, category_name, allocation_metadata' )?.eq('source_tab', 'Banking')?.in('card_last4', MAIN_ACCOUNTS)?.eq('expense_status', 'posted')?.gte('expense_date', lastMonthStart)?.lte('expense_date', lastMonthEnd)?.order('expense_date', { ascending: false })?.limit(500);

      const { data: qC_ty, error: eC_ty } = await supabase?.from('expenses')?.select(
        'id, expense_date, amount, source_tab, expense_status, office_name, card_last4, merchant_name, vendor_name, notes, category_name, allocation_metadata' )?.eq('source_tab', 'Banking')?.in('card_last4', MAIN_ACCOUNTS)?.eq('expense_status', 'posted')?.gte('expense_date', thisYearStart)?.lte('expense_date', thisYearEnd)?.order('expense_date', { ascending: false })?.limit(2000);

      const risky_lm = (qC_lm || [])?.filter(r => {
        const cls = (r?.allocation_metadata?.wf_classification || '')?.toLowerCase();
        return (!cls || cls === 'needs_review' || cls === 'unassigned_needs_review') && Math.abs(parseFloat(r?.amount) || 0) > 0;
      });
      const risky_ty = (qC_ty || [])?.filter(r => {
        const cls = (r?.allocation_metadata?.wf_classification || '')?.toLowerCase();
        return (!cls || cls === 'needs_review' || cls === 'unassigned_needs_review') && Math.abs(parseFloat(r?.amount) || 0) > 0;
      });

      const top20_lm = [...risky_lm]?.sort((a, b) => Math.abs(parseFloat(b?.amount) || 0) - Math.abs(parseFloat(a?.amount) || 0))?.slice(0, 20);
      const top20_ty = [...risky_ty]?.sort((a, b) => Math.abs(parseFloat(b?.amount) || 0) - Math.abs(parseFloat(a?.amount) || 0))?.slice(0, 20);

      const totalAmt_lm = risky_lm?.reduce((s, r) => s + Math.abs(parseFloat(r?.amount) || 0), 0);
      const totalAmt_ty = risky_ty?.reduce((s, r) => s + Math.abs(parseFloat(r?.amount) || 0), 0);

      // By account
      const byAcct_lm = {};
      risky_lm?.forEach(r => {
        const a = r?.card_last4 || 'unknown';
        if (!byAcct_lm?.[a]) byAcct_lm[a] = { count: 0, totalAmt: 0, office: r?.office_name };
        byAcct_lm[a].count++;
        byAcct_lm[a].totalAmt += Math.abs(parseFloat(r?.amount) || 0);
      });
      const byAcct_ty = {};
      risky_ty?.forEach(r => {
        const a = r?.card_last4 || 'unknown';
        if (!byAcct_ty?.[a]) byAcct_ty[a] = { count: 0, totalAmt: 0, office: r?.office_name };
        byAcct_ty[a].count++;
        byAcct_ty[a].totalAmt += Math.abs(parseFloat(r?.amount) || 0);
      });

      console.log('[V292-QUERY-C] Last Month — total posted Banking rows:', qC_lm?.length, '| error:', eC_lm?.message);
      console.log('[V292-QUERY-C] Last Month — risky unclassified count:', risky_lm?.length, '| total abs amount:', totalAmt_lm?.toFixed(2));
      console.log('[V292-QUERY-C-LM-BY-ACCOUNT]', JSON.stringify(byAcct_lm));
      console.log('[V292-QUERY-C-LM-TOP20]', JSON.stringify(top20_lm?.map(r => ({
        expense_date: r?.expense_date,
        amount: r?.amount,
        card_last4: r?.card_last4,
        office_name: r?.office_name,
        merchant_name: r?.merchant_name,
        vendor_name: r?.vendor_name,
        notes: r?.notes,
        category_name: r?.category_name,
        wf_classification: r?.allocation_metadata?.wf_classification,
        direction: r?.allocation_metadata?.direction,
        looksLikeTransfer: looksLikeTransfer(r),
        looksLikeRent: [r?.merchant_name, r?.vendor_name, r?.notes, r?.category_name]?.filter(Boolean)?.join(' ')?.toLowerCase()?.match(/rent|lease|occupancy|landlord|realty|building/),
        looksLikeAmex: [r?.merchant_name, r?.vendor_name, r?.notes]?.filter(Boolean)?.join(' ')?.toLowerCase()?.match(/amex|american express/),
        looksLikePayroll: [r?.merchant_name, r?.vendor_name, r?.notes]?.filter(Boolean)?.join(' ')?.toLowerCase()?.match(/gusto|payroll|eftps/),
      }))));

      console.log('[V292-QUERY-C] This Year — total posted Banking rows:', qC_ty?.length, '| error:', eC_ty?.message);
      console.log('[V292-QUERY-C] This Year — risky unclassified count:', risky_ty?.length, '| total abs amount:', totalAmt_ty?.toFixed(2));
      console.log('[V292-QUERY-C-TY-BY-ACCOUNT]', JSON.stringify(byAcct_ty));
      console.log('[V292-QUERY-C-TY-TOP20]', JSON.stringify(top20_ty?.map(r => ({
        expense_date: r?.expense_date,
        amount: r?.amount,
        card_last4: r?.card_last4,
        office_name: r?.office_name,
        merchant_name: r?.merchant_name,
        vendor_name: r?.vendor_name,
        notes: r?.notes,
        category_name: r?.category_name,
        wf_classification: r?.allocation_metadata?.wf_classification,
        direction: r?.allocation_metadata?.direction,
        looksLikeTransfer: looksLikeTransfer(r),
        looksLikeRent: [r?.merchant_name, r?.vendor_name, r?.notes, r?.category_name]?.filter(Boolean)?.join(' ')?.toLowerCase()?.match(/rent|lease|occupancy|landlord|realty|building/),
        looksLikeAmex: [r?.merchant_name, r?.vendor_name, r?.notes]?.filter(Boolean)?.join(' ')?.toLowerCase()?.match(/amex|american express/),
        looksLikePayroll: [r?.merchant_name, r?.vendor_name, r?.notes]?.filter(Boolean)?.join(' ')?.toLowerCase()?.match(/gusto|payroll|eftps/),
      }))));

      // ── QUERY D: Excluded transfer totals by classification ──
      const { data: qD_lm, error: eD_lm } = await supabase?.from('expenses')?.select(
        'id, expense_date, amount, source_tab, card_last4, office_name, merchant_name, vendor_name, notes, category_name, allocation_metadata, expense_status' )?.eq('source_tab', 'Banking')?.in('card_last4', MAIN_ACCOUNTS)?.gte('expense_date', lastMonthStart)?.lte('expense_date', lastMonthEnd)?.limit(2000);

      const { data: qD_ty, error: eD_ty } = await supabase?.from('expenses')?.select(
        'id, expense_date, amount, source_tab, card_last4, office_name, merchant_name, vendor_name, notes, category_name, allocation_metadata, expense_status' )?.eq('source_tab', 'Banking')?.in('card_last4', MAIN_ACCOUNTS)?.gte('expense_date', thisYearStart)?.lte('expense_date', thisYearEnd)?.limit(5000);

      function buildClassificationTotals(rows) {
        const totals = {};
        (rows || [])?.forEach(r => {
          const cls = (r?.allocation_metadata?.wf_classification || '')?.toLowerCase() || 'blank/unclassified';
          const amt = Math.abs(parseFloat(r?.amount) || 0);
          if (!totals?.[cls]) totals[cls] = { count: 0, totalAmt: 0 };
          totals[cls].count++;
          totals[cls].totalAmt += amt;
        });
        return totals;
      }

      function findOffice3526Candidates(rows) {
        return (rows || [])?.filter(r => {
          const h = [r?.merchant_name, r?.vendor_name, r?.notes, r?.category_name]?.filter(Boolean)?.join(' ')?.toLowerCase();
          const isFromOffice = OFFICE_ACCOUNTS?.includes(r?.card_last4);
          const isTo3526 = TRANSFER_KEYWORDS?.some(kw => h?.includes(kw));
          const isReceiving3526 = r?.card_last4 === '3526' && TRANSFER_KEYWORDS?.some(kw => h?.includes(kw));
          return (isFromOffice && isTo3526) || isReceiving3526;
        });
      }

      const totals_lm = buildClassificationTotals(qD_lm);
      const totals_ty = buildClassificationTotals(qD_ty);
      const o3526_lm = findOffice3526Candidates(qD_lm);
      const o3526_ty = findOffice3526Candidates(qD_ty);

      const o3526ByOffice_lm = {};
      o3526_lm?.forEach(r => {
        const k = r?.office_name || `acct-${r?.card_last4}`;
        if (!o3526ByOffice_lm?.[k]) o3526ByOffice_lm[k] = { count: 0, totalAmt: 0 };
        o3526ByOffice_lm[k].count++;
        o3526ByOffice_lm[k].totalAmt += Math.abs(parseFloat(r?.amount) || 0);
      });
      const o3526ByOffice_ty = {};
      o3526_ty?.forEach(r => {
        const k = r?.office_name || `acct-${r?.card_last4}`;
        if (!o3526ByOffice_ty?.[k]) o3526ByOffice_ty[k] = { count: 0, totalAmt: 0 };
        o3526ByOffice_ty[k].count++;
        o3526ByOffice_ty[k].totalAmt += Math.abs(parseFloat(r?.amount) || 0);
      });

      console.log('[V292-QUERY-D] Last Month — total Banking rows:', qD_lm?.length, '| error:', eD_lm?.message);
      console.log('[V292-QUERY-D-LM-CLASSIFICATION-TOTALS]', JSON.stringify(totals_lm));
      console.log('[V292-QUERY-D] Last Month — office-to-3526 keyword candidates:', o3526_lm?.length, '| total amt:', o3526_lm?.reduce((s, r) => s + Math.abs(parseFloat(r?.amount) || 0), 0)?.toFixed(2));
      console.log('[V292-QUERY-D-LM-OFFICE3526-BY-OFFICE]', JSON.stringify(o3526ByOffice_lm));
      console.log('[V292-QUERY-D-LM-OFFICE3526-ROWS]', JSON.stringify(o3526_lm?.map(r => ({
        expense_date: r?.expense_date,
        amount: r?.amount,
        card_last4: r?.card_last4,
        office_name: r?.office_name,
        expense_status: r?.expense_status,
        merchant_name: r?.merchant_name,
        vendor_name: r?.vendor_name,
        notes: r?.notes,
        category_name: r?.category_name,
        wf_classification: r?.allocation_metadata?.wf_classification,
        direction: r?.allocation_metadata?.direction,
      }))));

      console.log('[V292-QUERY-D] This Year — total Banking rows:', qD_ty?.length, '| error:', eD_ty?.message);
      console.log('[V292-QUERY-D-TY-CLASSIFICATION-TOTALS]', JSON.stringify(totals_ty));
      console.log('[V292-QUERY-D] This Year — office-to-3526 keyword candidates:', o3526_ty?.length, '| total amt:', o3526_ty?.reduce((s, r) => s + Math.abs(parseFloat(r?.amount) || 0), 0)?.toFixed(2));
      console.log('[V292-QUERY-D-TY-OFFICE3526-BY-OFFICE]', JSON.stringify(o3526ByOffice_ty));

      console.log('[V292-LOGGER] ALL QUERIES COMPLETE');
    }

    run()?.catch(err => console.error('[V292-LOGGER] ERROR:', err?.message));
  }, []);

  return null; // No UI — console only
}
