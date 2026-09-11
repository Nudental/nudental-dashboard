/**
 * amexPaymentsService.js
 *
 * Dedicated service for the AmEx Payments ledger (amex_payments table).
 * Completely separate from expenseReportService — does NOT touch
 * amex_raw_transactions, expenses, or any existing AmEx spend logic.
 *
 * Source type: 'amex_payment' — safe for downstream expense analysis.
 */

import { supabase } from '../lib/supabase';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

export const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'text-warning bg-warning/10' },
  { value: 'posted',  label: 'Posted',  color: 'text-blue-600 bg-blue-50' },
  { value: 'cleared', label: 'Cleared', color: 'text-success bg-success/10' },
  { value: 'void',    label: 'Void',    color: 'text-muted-foreground bg-muted/40' },
];

export const PAYMENT_SOURCE_TYPES = [
  { value: 'manual',   label: 'Manual Entry' },
  { value: 'imported', label: 'Imported' },
  { value: 'api',      label: 'API Sync' },
];

export const MONTHS = [
  { value: 1,  label: 'January' },
  { value: 2,  label: 'February' },
  { value: 3,  label: 'March' },
  { value: 4,  label: 'April' },
  { value: 5,  label: 'May' },
  { value: 6,  label: 'June' },
  { value: 7,  label: 'July' },
  { value: 8,  label: 'August' },
  { value: 9,  label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

// ── HELPERS ───────────────────────────────────────────────────────────────────

export function getStatusMeta(status) {
  return PAYMENT_STATUSES?.find(s => s?.value === status) || PAYMENT_STATUSES?.[0];
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })?.format(amount || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00')?.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildStatementPeriodLabel(start, end) {
  if (!start || !end) return '—';
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return `${s?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

// ── FETCH: list payments with filters ────────────────────────────────────────

export async function fetchAmexPayments({
  month = null,
  quarter = null,
  year = null,
  statementPeriodStart = null,
  statementPeriodEnd = null,
  paymentStatus = null,
  cardLast4 = null,
  limit = 200,
  offset = 0,
} = {}) {
  try {
    let query = supabase?.from('amex_payments')?.select(`
        id,
        statement_period_start,
        statement_period_end,
        statement_month,
        statement_year,
        payment_date,
        amount_paid,
        payment_status,
        payment_reference,
        card_last4,
        card_program,
        source_type,
        notes,
        created_by,
        created_at,
        updated_at,
        user_profiles:created_by ( full_name )
      `)?.order('payment_date', { ascending: false })?.range(offset, offset + limit - 1);

    if (month) query = query?.eq('statement_month', month);
    if (year)  query = query?.eq('statement_year', year);
    if (paymentStatus && paymentStatus !== 'All') query = query?.eq('payment_status', paymentStatus);
    if (cardLast4) query = query?.ilike('card_last4', `%${cardLast4}%`);

    if (statementPeriodStart) query = query?.gte('statement_period_start', statementPeriodStart);
    if (statementPeriodEnd)   query = query?.lte('statement_period_end', statementPeriodEnd);

    if (quarter) {
      const qMap = { 1: [1,3], 2: [4,6], 3: [7,9], 4: [10,12] };
      const [qStart, qEnd] = qMap?.[quarter] || [1, 12];
      query = query?.gte('statement_month', qStart)?.lte('statement_month', qEnd);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || [])?.map(row => ({
      ...row,
      createdByName: row?.user_profiles?.full_name || '—',
    }));
  } catch (err) {
    console.warn('[amexPaymentsService] fetchAmexPayments error:', err?.message);
    return [];
  }
}

// ── FETCH: summary KPIs ───────────────────────────────────────────────────────

export async function fetchAmexPaymentKPIs({ year = null } = {}) {
  try {
    const now = new Date();
    const currentYear  = year || now?.getFullYear();
    const currentMonth = now?.getMonth() + 1;

    // All payments for the year
    const { data: yearData, error: yearErr } = await supabase?.from('amex_payments')?.select('amount_paid, payment_status, payment_date, statement_month, statement_year')?.eq('statement_year', currentYear)?.neq('payment_status', 'void');

    if (yearErr) throw yearErr;

    const yearRows = yearData || [];

    // This month
    const monthRows = yearRows?.filter(r => r?.statement_month === currentMonth);

    const totalPaidThisMonth = monthRows?.reduce((s, r) => s + (parseFloat(r?.amount_paid) || 0), 0);
    const totalPaidThisYear  = yearRows?.reduce((s, r) => s + (parseFloat(r?.amount_paid) || 0), 0);
    const numberOfPayments   = yearRows?.length;

    // Latest payment date
    const sortedDates = yearRows
      ?.map(r => r?.payment_date)
      ?.filter(Boolean)
      ?.sort((a, b) => new Date(b) - new Date(a));
    const latestPaymentDate = sortedDates?.[0] || null;

    return {
      totalPaidThisMonth,
      totalPaidThisYear,
      numberOfPayments,
      latestPaymentDate,
    };
  } catch (err) {
    console.warn('[amexPaymentsService] fetchAmexPaymentKPIs error:', err?.message);
    return {
      totalPaidThisMonth: 0,
      totalPaidThisYear: 0,
      numberOfPayments: 0,
      latestPaymentDate: null,
    };
  }
}

// ── CREATE: new payment ───────────────────────────────────────────────────────

export async function createAmexPayment(payload, userId) {
  try {
    const {
      statementPeriodStart,
      statementPeriodEnd,
      statementMonth,
      statementYear,
      paymentDate,
      amountPaid,
      paymentStatus,
      paymentReference,
      cardLast4,
      cardProgram,
      notes,
    } = payload;

    // Validation
    if (!paymentDate)           throw new Error('Payment date is required.');
    if (!statementPeriodStart)  throw new Error('Statement period start is required.');
    if (!statementPeriodEnd)    throw new Error('Statement period end is required.');
    if (!paymentStatus)         throw new Error('Payment status is required.');
    const amount = parseFloat(amountPaid);
    if (isNaN(amount) || amount <= 0) throw new Error('Amount must be a positive number.');

    const { data, error } = await supabase?.from('amex_payments')?.insert([{
        statement_period_start: statementPeriodStart,
        statement_period_end:   statementPeriodEnd,
        statement_month:        parseInt(statementMonth, 10),
        statement_year:         parseInt(statementYear, 10),
        payment_date:           paymentDate,
        amount_paid:            amount,
        payment_status:         paymentStatus,
        payment_reference:      paymentReference || null,
        card_last4:             cardLast4 || null,
        card_program:           cardProgram || null,
        source_type:            'manual',
        notes:                  notes || null,
        created_by:             userId || null,
      }])?.select()?.single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.warn('[amexPaymentsService] createAmexPayment error:', err?.message);
    return { success: false, error: err?.message };
  }
}

// ── UPDATE: payment record ────────────────────────────────────────────────────

export async function updateAmexPayment(id, updates) {
  try {
    const { data, error } = await supabase?.from('amex_payments')?.update({
        payment_status:    updates?.paymentStatus,
        payment_reference: updates?.paymentReference,
        notes:             updates?.notes,
        amount_paid:       parseFloat(updates?.amountPaid),
      })?.eq('id', id)?.select()?.single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.warn('[amexPaymentsService] updateAmexPayment error:', err?.message);
    return { success: false, error: err?.message };
  }
}

// ── EXPORT: CSV ───────────────────────────────────────────────────────────────

export function formatPaymentsForCSV(rows) {
  const headers = [
    'Statement Period',
    'Payment Date',
    'Amount Paid',
    'Payment Status',
    'Card / Account',
    'Card Last 4',
    'Reference Number',
    'Source Type',
    'Notes',
    'Created By',
    'Created At',
  ];

  const csvRows = (rows || [])?.map(r => [
    buildStatementPeriodLabel(r?.statement_period_start, r?.statement_period_end),
    formatDate(r?.payment_date),
    r?.amount_paid,
    r?.payment_status,
    r?.card_program || '—',
    r?.card_last4 || '—',
    r?.payment_reference || '—',
    r?.source_type,
    (r?.notes || '')?.replace(/,/g, ';'),
    r?.createdByName || '—',
    r?.created_at ? new Date(r?.created_at)?.toLocaleDateString() : '—',
  ]);

  return [headers, ...csvRows]?.map(row => row?.join(','))?.join('\n');
}
