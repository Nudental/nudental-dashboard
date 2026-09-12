import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { LOCATION_ID_MAP, OFFICE_MAP } from '../../../constants/offices';
import { fmtCurrency, fmtDate, downloadCsv, rowsToCsv } from '../../../services/rcmService';
import { useAuth } from '../../../contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_OFFICES = [
  { officeId: '220372a5-afae-49c9-8a0c-f4c0717ff352', officeName: 'Eatontown',     locationId: '14000000000433' },
  { officeId: 'b0abcc46-55e8-4529-a28f-eedf41c1d72e', officeName: 'Staten Island', locationId: '14000000000432' },
  { officeId: '54626997-57c2-4934-8743-1dabb4d176f4', officeName: 'Brick',         locationId: '14000000000435' },
  { officeId: '1c719b5b-fd77-4da8-a1b9-2209f1cea63e', officeName: 'Barnegat',      locationId: '14000000000434' },
];

const PAGE_SIZE = 500;

const ACTIVE_INSURANCE_STATUSES = ['SENT', 'ACCEPTED', 'PREDETERMINATION', 'SUBMITTED', 'PENDING', 'IN_PROCESS'];

// Contact method options: { label, value, source_action }
const CONTACT_METHODS = [
  { label: 'Dentrix eStatement Sent',          value: 'STATEMENT_DENTRIX',  source_action: 'dentrix_estatement_sent' },
  { label: 'Dentrix Text/eStatement Sent',     value: 'STATEMENT_DENTRIX',  source_action: 'dentrix_text_estatement_sent' },
  { label: 'Phone Call',                       value: 'PHONE_CALL',         source_action: 'phone_call' },
  { label: 'Voicemail',                        value: 'VOICEMAIL',          source_action: 'voicemail' },
  { label: 'Manual Email',                     value: 'EMAIL_MANUAL',       source_action: 'email_manual' },
  { label: 'Copy Phone',                       value: 'COPY_PHONE',         source_action: 'copy_phone' },
  { label: 'Copy Email',                       value: 'COPY_EMAIL',         source_action: 'copy_email' },
  { label: 'Other',                            value: 'OTHER',              source_action: 'other' },
];

const DENTRIX_STATEMENT_VALUES = ['STATEMENT_DENTRIX'];

const CONTACT_OUTCOMES = [
  { label: 'Reached',           value: 'REACHED' },
  { label: 'Voicemail Left',    value: 'VOICEMAIL_LEFT' },
  { label: 'No Answer',         value: 'NO_ANSWER' },
  { label: 'Wrong Number',      value: 'WRONG_NUMBER' },
  { label: 'Wrong Email',       value: 'WRONG_EMAIL' },
  { label: 'Paid',              value: 'PAID' },
  { label: 'Resolved',          value: 'RESOLVED' },
  { label: 'Follow-Up Needed',  value: 'FOLLOW_UP_NEEDED' },
  { label: 'Note Only',         value: 'NOTE_ONLY' },
];

const RESOLVED_OUTCOMES = ['PAID', 'RESOLVED'];

const FILTER_CHIPS = [
  { id: 'all',                      label: 'All Outstanding' },
  { id: 'over90',                   label: 'Over 90 Days' },
  { id: 'insurance',                label: 'Insurance Pending' },
  { id: 'selfpay',                  label: 'Self-Pay / No Insurance' },
  { id: 'recent_payment',           label: 'Recently Paid' },
  { id: 'high_balance',             label: 'High Balance > $1,000' },
  { id: 'active_only',              label: 'Active Patients Only' },
  { id: 'ready_to_contact',         label: 'Ready to Contact' },
  { id: 'needs_review',             label: 'Needs Review' },
  { id: 'no_contact_info',          label: 'No Contact Info' },
  // Phase 1C chips
  { id: 'not_yet_contacted',        label: 'Not Yet Contacted' },
  { id: 'followup_needed',          label: 'Follow-Up Needed' },
  { id: 'resolved_paid',            label: 'Resolved / Paid' },
  { id: 'dentrix_stmt_sent',        label: 'Dentrix Statement Sent' },
  // Phase 1D chips
  { id: 'dentrix_stmt_exists',      label: 'Dentrix Statement Exists' },
  { id: 'no_dentrix_stmt',          label: 'No Dentrix Statement' },
  { id: 'recent_dentrix_stmt',      label: 'Recent Dentrix Statement' },
  { id: 'dentrix_electronic',       label: 'Dentrix Electronic Statement' },
  { id: 'dentrix_print',            label: 'Dentrix Print Statement' },
  // Phase 2A chips
  { id: 'payment_after_outreach',   label: 'Payment Activity After Outreach' },
  { id: 'followup_due',             label: 'Follow-Up Due' },
  { id: 'still_open_after_outreach',label: 'Still Open After Outreach' },
  { id: 'needs_second_attempt',     label: 'Needs Second Attempt' },
  { id: 'my_followups',             label: 'My Follow-Ups' },
  { id: 'staff_review',             label: 'Staff Review' },
];

const COLUMNS = [
  { key: 'patient_name',                  label: 'Patient Name' },
  { key: 'chart_number',                  label: 'Chart #' },
  { key: 'office_name',                   label: 'Office' },
  { key: 'balance',                       label: 'Patient-Level AR' },
  { key: 'aging_bucket',                  label: 'Aging Bucket' },
  { key: 'days_outstanding',              label: 'Days Outstanding' },
  { key: 'last_payment_date',             label: 'Last Payment' },
  { key: 'last_payment_amount',           label: 'Last Pmt Amt' },
  { key: 'provider_name',                 label: 'Provider' },
  { key: 'payor_name',                    label: 'Payor / Plan' },
  { key: 'collection_status',             label: 'Claim Status' },
  { key: 'mobile_phone',                  label: 'Mobile' },
  { key: 'email',                         label: 'Email' },
  { key: 'contact_preference',            label: 'Contact Pref' },
  { key: 'patient_status',               label: 'Pt Status' },
  { key: 'contact_readiness',             label: 'Contact Readiness' },
  // Phase 1C columns
  { key: 'last_contacted_at',             label: 'Last Contact' },
  { key: 'last_contact_outcome',          label: 'Contact Outcome' },
  { key: 'attempt_count',                 label: 'Attempt Count' },
  { key: 'next_followup_date',            label: 'Next Follow-Up' },
  { key: 'contacted_by_name',             label: 'Last Contacted By' },
  // Phase 1D columns
  { key: 'dentrix_statement_count',       label: 'Dentrix Statements' },
  { key: 'dentrix_last_statement_date',   label: 'Last Dentrix Statement' },
  { key: 'dentrix_last_delivery_method',  label: 'Dentrix Delivery Method' },
  { key: 'dentrix_last_patient_portion',  label: 'Last Patient Portion' },
  { key: 'dentrix_last_please_pay',       label: 'Last Please Pay' },
  // Phase 2A columns
  { key: 'outcome_status',               label: 'Outcome Status' },
  { key: 'days_since_last_outreach',     label: 'Days Since Outreach' },
  { key: 'outreach_anchor_date',         label: 'Outreach Anchor Date' },
  { key: 'payment_after_outreach',       label: 'Payment Activity After Outreach' },
  { key: 'still_open_after_outreach',    label: 'Still Open After Outreach' },
  { key: 'followup_due',                 label: 'Follow-Up Due' },
  { key: 'needs_second_attempt',         label: 'Needs Second Attempt' },
];

const TOTAL_COLS = COLUMNS?.length + 2; // +1 expand, +1 Log Attempt action

// ─── Contact Readiness Logic ──────────────────────────────────────────────────

const deriveContactReadiness = (row) => {
  const balance        = row?.balance || 0;
  const cs             = String(row?.collection_status || '')?.toUpperCase();
  const isInsurancePending = ACTIVE_INSURANCE_STATUSES?.some(s => cs?.includes(s));
  const patientStatus  = String(row?.patient_status || '')?.toUpperCase();
  const isActive       = patientStatus === 'ACTIVE';
  const hasMobile      = row?.has_mobile_phone === true || (row?.has_mobile_phone !== false && !!row?.mobile_phone);
  const hasEmail       = row?.has_email === true || (row?.has_email !== false && !!row?.email);
  const hasContact     = hasMobile || hasEmail;

  let isRecentlyPaid = false;
  if (row?.last_payment_date) {
    const now = new Date();
    const cutoff14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const lpd = new Date(row.last_payment_date);
    isRecentlyPaid = lpd >= cutoff14 && balance > 0;
  }

  const isSelfPay = !row?.claim_id && !row?.payor_name;
  const isHighBalance = balance >= 1000;

  if (isInsurancePending) return 'Insurance Pending';
  if (isRecentlyPaid) return 'Recently Paid — Review';
  if (!hasContact) return 'No Contact Info';
  if (!isActive) return 'Inactive Patient';
  if (isSelfPay) return 'Self-Pay Review';
  if (isHighBalance) return 'High Balance Priority';
  if (balance > 0 && isActive && hasContact) return 'Ready to Contact';
  return 'Needs Review';
};

const deriveReadinessReason = (row) => {
  const reasons = [];
  const cs = String(row?.collection_status || '')?.toUpperCase();
  const isInsurancePending = ACTIVE_INSURANCE_STATUSES?.some(s => cs?.includes(s));
  const patientStatus = String(row?.patient_status || '')?.toUpperCase();
  const hasMobile = row?.has_mobile_phone === true || (row?.has_mobile_phone !== false && !!row?.mobile_phone);
  const hasEmail  = row?.has_email === true || (row?.has_email !== false && !!row?.email);

  if (isInsurancePending) reasons?.push(`Insurance status: ${row?.collection_status || 'Pending'} — awaiting insurer action`);
  if (row?.last_payment_date) {
    const now = new Date();
    const cutoff14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const lpd = new Date(row.last_payment_date);
    if (lpd >= cutoff14 && (row?.balance || 0) > 0) reasons?.push(`Recent payment on ${fmtDate(row?.last_payment_date)} — balance may be in transit`);
  }
  if (!hasMobile && !hasEmail) reasons?.push('No mobile phone or email on file');
  else {
    if (hasMobile) reasons?.push('Mobile phone available');
    if (hasEmail) reasons?.push('Email available');
  }
  if (patientStatus && patientStatus !== 'ACTIVE') reasons?.push(`Patient status: ${row?.patient_status}`);
  if (!row?.claim_id && !row?.payor_name) reasons?.push('No claim or payor — self-pay account');
  if ((row?.balance || 0) >= 1000) reasons?.push(`High balance: ${fmtCurrency(row?.balance)}`);
  return reasons;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveLocationId = (officeId) => {
  if (!officeId) return null;
  return LOCATION_ID_MAP?.[officeId] || null;
};

const locationIdToOfficeName = (locationId) => {
  const office = ALL_OFFICES?.find(o => o?.locationId === String(locationId));
  return office?.officeName || locationId || '—';
};

const normalizeRow = (raw, officeName) => {
  const balance = parseFloat(raw?.balance ?? raw?.patientBalance ?? raw?.outstanding_balance ?? 0) || 0;
  const bucketCurrent = parseFloat(raw?.bucket_current ?? raw?.bucketCurrent ?? 0) || 0;
  const bucket30      = parseFloat(raw?.bucket_30 ?? raw?.bucket30 ?? 0) || 0;
  const bucket60      = parseFloat(raw?.bucket_60 ?? raw?.bucket60 ?? 0) || 0;
  const bucket90      = parseFloat(raw?.bucket_90 ?? raw?.bucket90 ?? 0) || 0;
  const daysOut       = parseInt(raw?.days_outstanding ?? raw?.daysOutstanding ?? 0, 10) || 0;

  const agingBucket = raw?.aging_bucket || raw?.agingBucket || (
    daysOut >= 90 ? '90+' :
    daysOut >= 60 ? '61-90' :
    daysOut >= 30 ? '31-60' : 'Current'
  );

  const normalized = {
    _id:                  JSON.stringify([raw?.patient_id || raw?.patientId || raw?.id || crypto.randomUUID(), raw?.location_id || raw?.locationId || raw?.office_id || raw?.officeId || officeName || '']),
    patient_name:         raw?.patient_name || raw?.patientName || '—',
    patient_id:           raw?.patient_id || raw?.patientId || '—',
    chart_number:         raw?.chart_number || raw?.chartNumber || raw?.patient_id || raw?.patientId || '—',
    office_name:          raw?.office_name || raw?.officeName || officeName || '—',
    office_id:            raw?.office_id || raw?.officeId || null,
    location_id:          raw?.location_id || raw?.locationId || null,
    balance,
    aging_bucket:         agingBucket,
    bucket_current:       bucketCurrent,
    bucket_30:            bucket30,
    bucket_60:            bucket60,
    bucket_90:            bucket90,
    days_outstanding:     daysOut,
    last_payment_date:    raw?.last_payment_date || raw?.lastPaymentDate || null,
    last_payment_amount:  parseFloat(raw?.last_payment_amount ?? raw?.lastPaymentAmount ?? 0) || 0,
    provider_name:        raw?.provider_name || raw?.providerName || '—',
    provider_id:          raw?.provider_id || raw?.providerId || null,
    payor_name:           raw?.payor_name || raw?.payorName || raw?.payer_name || null,
    plan_name:            raw?.plan_name || raw?.planName || null,
    collection_status:    raw?.collection_status || raw?.collectionStatus || null,
    claim_followup_action: raw?.claim_followup_action || raw?.claimFollowupAction || null,
    claim_id:             raw?.claim_id || raw?.claimId || null,
    charges:              parseFloat(raw?.charges ?? 0) || 0,
    payments:             parseFloat(raw?.payments ?? 0) || 0,
    insurance_paid:       parseFloat(raw?.insurance_paid ?? raw?.insurancePaid ?? 0) || 0,
    adjustments:          parseFloat(raw?.adjustments ?? 0) || 0,
    mobile_phone:         raw?.mobile_phone || raw?.mobilePhone || null,
    email:                raw?.email || null,
    contact_preference:   raw?.contact_preference || raw?.contactPreference || null,
    patient_status:       raw?.patient_status || raw?.patientStatus || null,
    primary_guarantor_id: raw?.primary_guarantor_id || raw?.primaryGuarantorId || null,
    is_self_guarantor:    raw?.is_self_guarantor ?? raw?.isSelfGuarantor ?? null,
    has_mobile_phone:     raw?.has_mobile_phone ?? raw?.hasMobilePhone ?? (!!raw?.mobile_phone || !!raw?.mobilePhone),
    has_email:            raw?.has_email ?? raw?.hasEmail ?? (!!raw?.email),
    // Phase 1C contact attempt fields (populated after summary merge)
    last_contacted_at:    null,
    last_contact_method:  null,
    last_contact_outcome: null,
    last_contact_note:    null,
    contacted_by_name:    null,
    next_followup_date:   null,
    is_resolved:          false,
    attempt_count:        0,
    // Phase 1D Dentrix statement fields (populated after outreach summary merge)
    dentrix_statement_count:        0,
    dentrix_last_statement_date:    null,
    dentrix_last_delivery_method:   null,
    dentrix_last_statement_type:    null,
    dentrix_last_patient_portion:   null,
    dentrix_last_please_pay:        null,
    dentrix_delivery_methods:       null,
    dentrix_statement_ids:          null,
    dentrix_document_ids:           null,
    // Phase 2A outcome fields (derived after all merges)
    outreach_anchor_date:           null,
    days_since_last_outreach:       null,
    payment_after_outreach:         false,
    still_open_after_outreach:      false,
    followup_due:                   false,
    needs_second_attempt:           false,
    outcome_status:                 'Not Contacted',
  };

  normalized.contact_readiness = deriveContactReadiness(normalized);
  return normalized;
};

const normalizeResponse = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw?.data;
  if (Array.isArray(raw?.result)) return raw?.result;
  if (Array.isArray(raw?.records)) return raw?.records;
  return [];
};

// Fetch all pages for a single locationId
const fetchAllPagesForLocation = async (start, end, locationId, officeName) => {
  let records = [];
  let page = 1;
  while (true) {
    const raw = await ascendApi?.getArAging(start, end, locationId, page, PAGE_SIZE);
    const rows = normalizeResponse(raw);
    if (!rows || rows?.length === 0) break;
    rows?.forEach(r => records?.push(normalizeRow(r, officeName)));
    if (rows?.length < PAGE_SIZE) break;
    page++;
  }
  return records;
};

// Normalize contact summary response to array
const normalizeContactSummary = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw?.data;
  if (Array.isArray(raw?.summary)) return raw?.summary;
  if (Array.isArray(raw?.records)) return raw?.records;
  return [];
};

// Merge contact summary into AR aging rows by patient_id (+ location_id when available)
const mergeContactSummary = (rows, summaryList) => {
  if (!summaryList?.length) return rows;
  // Build lookup: key = patient_id or patient_id|location_id
  const map = {};
  summaryList?.forEach(s => {
    const pid = s?.patient_id || s?.patientId;
    const lid = s?.location_id || s?.locationId;
    if (!pid) return;
    const keyWithLoc = lid ? `${pid}|${lid}` : null;
    const keyPid = pid;
    if (keyWithLoc) map[keyWithLoc] = s;
    map[keyPid] = s; // fallback
  });

  return rows?.map(row => {
    const pid = row?.patient_id;
    const lid = row?.location_id;
    const keyWithLoc = pid && lid ? `${pid}|${lid}` : null;
    const summary = (keyWithLoc && map?.[keyWithLoc]) || map?.[pid] || null;
    if (!summary) {
      // Still derive outcome fields even without summary
      const outcomeFields = deriveOutcomeFields(row);
      return { ...row, ...outcomeFields };
    }

    // Phase 1C contact attempt fields
    const merged = {
      ...row,
      last_contacted_at:    summary?.last_contacted_at || summary?.lastContactedAt || row?.last_contacted_at || null,
      last_contact_method:  summary?.last_contact_method || summary?.lastContactMethod || row?.last_contact_method || null,
      last_contact_outcome: summary?.last_contact_outcome || summary?.lastContactOutcome || row?.last_contact_outcome || null,
      last_contact_note:    summary?.last_contact_note || summary?.lastContactNote || row?.last_contact_note || null,
      contacted_by_name:    summary?.contacted_by_name || summary?.contactedByName || row?.contacted_by_name || null,
      next_followup_date:   summary?.next_followup_date || summary?.nextFollowupDate || row?.next_followup_date || null,
      is_resolved:          summary?.is_resolved ?? summary?.isResolved ?? row?.is_resolved ?? false,
      attempt_count:        parseInt(summary?.attempt_count ?? summary?.attemptCount ?? row?.attempt_count ?? 0, 10) || 0,
    };

    // Phase 1D Dentrix statement fields from outreach summary
    const dCount = parseInt(
      summary?.dentrix_statement_count ?? summary?.dentrixStatementCount ?? row?.dentrix_statement_count ?? 0,
      10
    ) || 0;
    merged.dentrix_statement_count      = dCount;
    merged.dentrix_last_statement_date  = summary?.dentrix_last_statement_date  || summary?.dentrixLastStatementDate  || row?.dentrix_last_statement_date  || null;
    merged.dentrix_last_delivery_method = summary?.dentrix_last_delivery_method || summary?.dentrixLastDeliveryMethod || row?.dentrix_last_delivery_method || null;
    merged.dentrix_last_statement_type  = summary?.dentrix_last_statement_type  || summary?.dentrixLastStatementType  || row?.dentrix_last_statement_type  || null;
    // Patient outreach amounts: patient_portion / please_pay ONLY — never total_balance
    merged.dentrix_last_patient_portion = parseFloat(
      summary?.dentrix_last_patient_portion ?? summary?.dentrixLastPatientPortion ?? row?.dentrix_last_patient_portion ?? null
    ) || null;
    merged.dentrix_last_please_pay      = parseFloat(
      summary?.dentrix_last_please_pay ?? summary?.dentrixLastPleasePay ?? row?.dentrix_last_please_pay ?? null
    ) || null;
    merged.dentrix_delivery_methods     = summary?.dentrix_delivery_methods || summary?.dentrixDeliveryMethods || row?.dentrix_delivery_methods || null;
    merged.dentrix_statement_ids        = summary?.dentrix_statement_ids    || summary?.dentrixStatementIds    || row?.dentrix_statement_ids    || null;
    merged.dentrix_document_ids         = summary?.dentrix_document_ids     || summary?.dentrixDocumentIds     || row?.dentrix_document_ids     || null;

    // Phase 2A: derive outcome fields after all merges
    const outcomeFields = deriveOutcomeFields(merged);
    return { ...merged, ...outcomeFields };
  });
};

// ─── Phase 2A: Derived Outcome Fields ────────────────────────────────────────

const deriveOutcomeFields = (row) => {
  const today = new Date();
  const todayStr = today?.toISOString()?.slice(0, 10);

  // 1. outreach_anchor_date: latest of last_contacted_at and dentrix_last_statement_date
  const lastContactedAt = row?.last_contacted_at || null;
  const dentrixLastStmt = row?.dentrix_last_statement_date || null;
  let outreach_anchor_date = null;
  if (lastContactedAt && dentrixLastStmt) {
    outreach_anchor_date = lastContactedAt > dentrixLastStmt ? lastContactedAt : dentrixLastStmt;
  } else {
    outreach_anchor_date = lastContactedAt || dentrixLastStmt || null;
  }

  // 2. days_since_last_outreach
  let days_since_last_outreach = null;
  if (outreach_anchor_date) {
    const anchor = new Date(outreach_anchor_date);
    const diffMs = today?.getTime() - anchor?.getTime();
    days_since_last_outreach = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // 3. payment_after_outreach
  const lastPaymentDate = row?.last_payment_date || null;
  const payment_after_outreach = !!(
    lastPaymentDate &&
    outreach_anchor_date &&
    lastPaymentDate > outreach_anchor_date
  );

  // 4. still_open_after_outreach
  const balance = row?.balance || 0;
  const is_resolved = row?.is_resolved === true;
  const still_open_after_outreach = !!(
    outreach_anchor_date &&
    balance > 0 &&
    !is_resolved
  );

  // 5. followup_due
  const nextFollowupDate = row?.next_followup_date || null;
  const followup_due = !!(
    (nextFollowupDate && nextFollowupDate <= todayStr) ||
    (
      outreach_anchor_date &&
      days_since_last_outreach !== null &&
      days_since_last_outreach > 14 &&
      balance > 0 &&
      !is_resolved
    )
  );

  // 6. needs_second_attempt
  const attempt_count = row?.attempt_count || 0;
  const last_contact_outcome = row?.last_contact_outcome || null;
  const needs_second_attempt = !!(
    outreach_anchor_date &&
    balance > 0 &&
    !is_resolved &&
    !payment_after_outreach &&
    days_since_last_outreach !== null &&
    days_since_last_outreach >= 7 &&
    attempt_count <= 1
  );

  // 7. outcome_status — priority order
  const contact_readiness = row?.contact_readiness || '';
  let outcome_status = 'Ready';

  if (contact_readiness === 'Insurance Pending') {
    outcome_status = 'Insurance Pending Review';
  } else if (is_resolved || RESOLVED_OUTCOMES?.includes(last_contact_outcome)) {
    outcome_status = 'Resolved / Paid';
  } else if (!lastContactedAt && !dentrixLastStmt) {
    outcome_status = 'Not Contacted';
  } else if (payment_after_outreach) {
    outcome_status = 'Payment Activity After Outreach';
  } else if (followup_due) {
    outcome_status = 'Follow-Up Due';
  } else if (needs_second_attempt) {
    outcome_status = 'Needs Second Attempt';
  } else if (still_open_after_outreach) {
    outcome_status = 'Still Open After Outreach';
  }

  return {
    outreach_anchor_date,
    days_since_last_outreach,
    payment_after_outreach,
    still_open_after_outreach,
    followup_due,
    needs_second_attempt,
    outcome_status,
  };
};

// ─── Phase 2A: Outcome Status Badge ──────────────────────────────────────────

const OutcomeStatusBadge = ({ status }) => {
  if (!status) return <span className="text-muted-foreground/40 text-xs">—</span>;
  const styleMap = {
    'Not Contacted':                    'bg-gray-100 text-gray-600 border-gray-200',
    'Follow-Up Due':                    'bg-amber-100 text-amber-800 border-amber-200',
    'Payment Activity After Outreach':  'bg-teal-100 text-teal-800 border-teal-200',
    'Still Open After Outreach':        'bg-orange-100 text-orange-800 border-orange-200',
    'Needs Second Attempt':             'bg-red-100 text-red-800 border-red-200',
    'Resolved / Paid':                  'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Insurance Pending Review':         'bg-blue-100 text-blue-800 border-blue-200',
    'Ready':                            'bg-green-100 text-green-700 border-green-200',
  };
  const iconMap = {
    'Not Contacted':                    'UserX',
    'Follow-Up Due':                    'Clock',
    'Payment Activity After Outreach':  'TrendingUp',
    'Still Open After Outreach':        'AlertCircle',
    'Needs Second Attempt':             'RefreshCw',
    'Resolved / Paid':                  'CheckCircle',
    'Insurance Pending Review':         'Shield',
    'Ready':                            'CheckCircle',
  };
  const cls = styleMap?.[status] || 'bg-muted text-muted-foreground border-border';
  const iconName = iconMap?.[status] || 'HelpCircle';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls} whitespace-nowrap`}>
      <Icon name={iconName} size={10} />
      {status}
    </span>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr className="animate-pulse">
    {Array.from({ length: TOTAL_COLS })?.map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="h-4 bg-muted rounded w-full" />
      </td>
    ))}
  </tr>
);

const AgingBadge = ({ bucket }) => {
  const map = {
    'Current': 'bg-green-100 text-green-700',
    '31-60':   'bg-amber-100 text-amber-700',
    '61-90':   'bg-orange-100 text-orange-700',
    '90+':     'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${map?.[bucket] || 'bg-muted text-muted-foreground'}`}>
      {bucket || '—'}
    </span>
  );
};

const ContactReadinessBadge = ({ status }) => {
  const styleMap = {
    'Ready to Contact':       'bg-green-100 text-green-800 border-green-200',
    'Insurance Pending':      'bg-blue-100 text-blue-800 border-blue-200',
    'Recently Paid — Review': 'bg-amber-100 text-amber-800 border-amber-200',
    'No Contact Info':        'bg-red-100 text-red-800 border-red-200',
    'Inactive Patient':       'bg-gray-100 text-gray-600 border-gray-200',
    'Self-Pay Review':        'bg-purple-100 text-purple-800 border-purple-200',
    'High Balance Priority':  'bg-orange-100 text-orange-800 border-orange-200',
    'Needs Review':           'bg-yellow-100 text-yellow-800 border-yellow-200',
  };
  const iconMap = {
    'Ready to Contact':       'CheckCircle',
    'Insurance Pending':      'Clock',
    'Recently Paid — Review': 'RefreshCw',
    'No Contact Info':        'PhoneOff',
    'Inactive Patient':       'UserX',
    'Self-Pay Review':        'DollarSign',
    'High Balance Priority':  'AlertTriangle',
    'Needs Review':           'HelpCircle',
  };
  const cls = styleMap?.[status] || 'bg-muted text-muted-foreground border-border';
  const iconName = iconMap?.[status] || 'HelpCircle';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls} whitespace-nowrap`}>
      <Icon name={iconName} size={10} />
      {status || '—'}
    </span>
  );
};

const OutcomeBadge = ({ outcome }) => {
  if (!outcome) return <span className="text-muted-foreground/40 text-xs">—</span>;
  const styleMap = {
    REACHED:          'bg-green-100 text-green-800',
    VOICEMAIL_LEFT:   'bg-blue-100 text-blue-800',
    NO_ANSWER:        'bg-gray-100 text-gray-600',
    WRONG_NUMBER:     'bg-red-100 text-red-700',
    WRONG_EMAIL:      'bg-red-100 text-red-700',
    PAID:             'bg-emerald-100 text-emerald-800',
    RESOLVED:         'bg-emerald-100 text-emerald-800',
    FOLLOW_UP_NEEDED: 'bg-amber-100 text-amber-800',
    NOTE_ONLY:        'bg-gray-100 text-gray-600',
  };
  const labelMap = {
    REACHED:          'Reached',
    VOICEMAIL_LEFT:   'Voicemail Left',
    NO_ANSWER:        'No Answer',
    WRONG_NUMBER:     'Wrong Number',
    WRONG_EMAIL:      'Wrong Email',
    PAID:             'Paid',
    RESOLVED:         'Resolved',
    FOLLOW_UP_NEEDED: 'Follow-Up Needed',
    NOTE_ONLY:        'Note Only',
  };
  const cls = styleMap?.[outcome] || 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls} whitespace-nowrap`}>
      {labelMap?.[outcome] || outcome}
    </span>
  );
};

const DaysColor = ({ days }) => {
  const cls = days >= 90 ? 'text-red-600 font-semibold' :
              days >= 60 ? 'text-orange-600 font-semibold' :
              days >= 30 ? 'text-amber-600 font-semibold' : 'text-green-600';
  return <span className={cls}>{days ?? 0}d</span>;
};

// ─── Open Dentrix Ledger Button ───────────────────────────────────────────────

const DENTRIX_LEDGER_BASE = 'https://live6.dentrixascend.com/pm#/ledger/';

const OpenDentrixLedgerButton = ({ patientId, size = 'sm' }) => {
  const hasId = patientId && patientId !== '—';
  const url = hasId ? `${DENTRIX_LEDGER_BASE}${patientId}` : null;

  const handleClick = (e) => {
    e?.stopPropagation();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (size === 'xs') {
    return (
      <button
        onClick={handleClick}
        disabled={!hasId}
        title={hasId ? `Open Dentrix Ledger for patient ${patientId}` : 'Dentrix patient ID unavailable'}
        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
          hasId
            ? 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400' :'border-border text-muted-foreground/40 cursor-not-allowed opacity-50'
        }`}
      >
        <Icon name="ExternalLink" size={11} />
        {hasId ? 'Open Dentrix Ledger' : 'Dentrix ID unavailable'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!hasId}
      title={hasId ? `Open Dentrix Ledger for patient ${patientId}` : 'Dentrix patient ID unavailable'}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap ${
        hasId
          ? 'border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400' :'border-border text-muted-foreground/40 cursor-not-allowed opacity-50'
      }`}
    >
      <Icon name="ExternalLink" size={12} />
      {hasId ? 'Open Dentrix Ledger' : 'Dentrix ID unavailable'}
    </button>
  );
};

const SortIcon = ({ col, sortKey, sortDir }) => (
  <span className="ml-1 inline-flex flex-col leading-none">
    <span className={`text-[8px] ${sortKey === col && sortDir === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}>▲</span>
    <span className={`text-[8px] ${sortKey === col && sortDir === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}>▼</span>
  </span>
);

const CopyButton = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  if (!value || value === '—') return null;
  const handleCopy = (e) => {
    e?.stopPropagation();
    navigator.clipboard?.writeText(String(value))?.then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label}`}
      className="ml-1 inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
    >
      <Icon name={copied ? 'Check' : 'Copy'} size={12} className={copied ? 'text-green-500' : ''} />
    </button>
  );
};

const ScoreCard = ({ label, value, sub = '', color = 'default' }) => {
  const colorMap = {
    default: 'bg-card border-border',
    blue:    'bg-blue-50 border-blue-200',
    green:   'bg-green-50 border-green-200',
    amber:   'bg-amber-50 border-amber-200',
    red:     'bg-red-50 border-red-200',
    purple:  'bg-purple-50 border-purple-200',
    teal:    'bg-teal-50 border-teal-200',
    indigo:  'bg-indigo-50 border-indigo-200',
  };
  const textMap = {
    default: 'text-foreground',
    blue:    'text-blue-900',
    green:   'text-green-900',
    amber:   'text-amber-900',
    red:     'text-red-900',
    purple:  'text-purple-900',
    teal:    'text-teal-900',
    indigo:  'text-indigo-900',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap?.[color]}`}>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${textMap?.[color]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
};

// ─── Log Attempt Modal ────────────────────────────────────────────────────────

const LogAttemptModal = ({ row, currentUser, userProfile, onClose, onSuccess }) => {
  const [contactMethodIdx, setContactMethodIdx] = useState(2); // default Phone Call
  const [outcome, setOutcome]           = useState('');
  const [note, setNote]                 = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [isResolved, setIsResolved]     = useState(false);
  const [insuranceConfirmed, setInsuranceConfirmed] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState(null);

  const selectedMethod = CONTACT_METHODS?.[contactMethodIdx];
  const isDentrixStatement = DENTRIX_STATEMENT_VALUES?.includes(selectedMethod?.value);
  const isInsurancePending = row?.contact_readiness === 'Insurance Pending';
  const requiresInsuranceConfirm = isDentrixStatement && isInsurancePending;

  // balance_at_contact must be patient-responsible balance only
  const balanceAtContact = row?.balance || row?.patientBalance || 0;

  const contactedById   = currentUser?.id || null;
  const contactedByName = userProfile?.full_name || userProfile?.display_name || userProfile?.username || currentUser?.email || null;

  const canSubmit = outcome && (!requiresInsuranceConfirm || insuranceConfirmed) && !submitting && !!contactedByName;

  // Phase 1D: check if a recent Dentrix statement exists for this patient
  const hasDentrixStatement = (row?.dentrix_statement_count || 0) > 0;
  const dentrixLastDate = row?.dentrix_last_statement_date || null;
  const dentrixLastMethod = row?.dentrix_last_delivery_method || null;
  const isRecentDentrixStmt = (() => {
    if (!dentrixLastDate) return false;
    const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return new Date(dentrixLastDate) >= cutoff30;
  })();

  // Phase 2A: outreach context for Log Attempt modal
  const daysSinceOutreach = row?.days_since_last_outreach ?? null;
  const paymentAfterOutreach = row?.payment_after_outreach === true;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = {
        patient_id:         row?.patient_id,
        chart_number:       row?.chart_number,
        location_id:        row?.location_id,
        office_name:        row?.office_name,
        balance_at_contact: balanceAtContact,
        contact_method:     selectedMethod?.value,
        contact_outcome:    outcome,
        contact_note:       note || null,
        next_followup_date: followupDate || null,
        is_resolved:        isResolved,
        source_tab:         'patient_balances',
        source_action:      selectedMethod?.source_action,
        ...(contactedById   ? { contacted_by: contactedById }         : {}),
        ...(contactedByName ? { contacted_by_name: contactedByName }  : {}),
      };
      await ascendApi?.postContactAttempt(body);
      onSuccess?.();
    } catch (err) {
      setSubmitError(err?.message || 'Failed to log contact attempt. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e?.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Log Attempt</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {row?.patient_name} · {row?.office_name} · Balance: <span className="font-semibold text-foreground">{fmtCurrency(balanceAtContact)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Open Dentrix Ledger helper action */}
        <div className="px-5 pt-3 pb-0">
          <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
            <Icon name="ExternalLink" size={13} className="flex-shrink-0 mt-0.5 text-indigo-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-indigo-800 mb-1.5">
                Opens Dentrix Ascend ledger. Staff must send Request To Pay / eStatement inside Dentrix, then log the attempt here.
              </p>
              <OpenDentrixLedgerButton patientId={row?.patient_id} size="xs" />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Phase 2A: Days since last outreach context */}
          {daysSinceOutreach !== null && (
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs text-slate-700">
              <Icon name="Clock" size={13} className="flex-shrink-0 mt-0.5 text-slate-400" />
              <span>
                <span className="font-semibold">{daysSinceOutreach} day{daysSinceOutreach !== 1 ? 's' : ''}</span> since last outreach
                {row?.outreach_anchor_date ? ` (${fmtDate(row?.outreach_anchor_date)})` : ''}.
              </span>
            </div>
          )}

          {/* Phase 2A: Payment activity after prior outreach hint */}
          {paymentAfterOutreach && (
            <div className="flex items-start gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2.5 text-xs text-teal-800">
              <Icon name="TrendingUp" size={13} className="flex-shrink-0 mt-0.5 text-teal-500" />
              <span>
                <span className="font-semibold">Payment activity after prior outreach.</span> A payment was recorded after the last outreach date. This does not necessarily mean the balance is fully paid.
              </span>
            </div>
          )}

          {/* Insurance Pending warning */}
          {isInsurancePending && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
              <Icon name="AlertCircle" size={14} className="flex-shrink-0 mt-0.5 text-blue-500" />
              <span>
                <strong>Review first:</strong> this row has insurance activity pending. Statement outreach should only request the patient-responsible balance.
              </span>
            </div>
          )}

          {/* Phase 1D: Dentrix statement context for Dentrix eStatement/text methods */}
          {isDentrixStatement && hasDentrixStatement && (
            <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5 text-xs text-indigo-800">
              <Icon name="FileText" size={14} className="flex-shrink-0 mt-0.5 text-indigo-500" />
              <div className="space-y-0.5">
                <p className="font-semibold">Dentrix Statement on File</p>
                <p>Last statement: {dentrixLastDate ? fmtDate(dentrixLastDate) : '—'}{dentrixLastMethod ? ` · ${dentrixLastMethod}` : ''}</p>
                {isRecentDentrixStmt && (
                  <p className="text-amber-700 font-medium">⚠ A Dentrix statement was sent within the last 30 days.</p>
                )}
                <p className="text-indigo-600 mt-1">
                  Record that staff sent or attempted a statement in Dentrix. This does not send from Nu Dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Phase 1D: No Dentrix statement context for Dentrix methods */}
          {isDentrixStatement && !hasDentrixStatement && (
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600">
              <Icon name="FileX" size={14} className="flex-shrink-0 mt-0.5" />
              <span>No Dentrix statement history found for this patient. Record that staff sent or attempted a statement in Dentrix. This does not send from Nu Dashboard.</span>
            </div>
          )}

          {/* Balance at contact (read-only, patient-responsible only) */}
          <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Balance at contact:</span> {fmtCurrency(balanceAtContact)}
            <span className="ml-2 text-muted-foreground/60">(patient-responsible balance only)</span>
          </div>

          {/* Contact Method */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Contact Method <span className="text-red-500">*</span></label>
            <select
              value={contactMethodIdx}
              onChange={e => { setContactMethodIdx(Number(e?.target?.value)); setInsuranceConfirmed(false); }}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CONTACT_METHODS?.map((m, i) => (
                <option key={i} value={i}>{m?.label}</option>
              ))}
            </select>
          </div>

          {/* Insurance confirmation checkbox for Dentrix statement methods */}
          {requiresInsuranceConfirm && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <input
                type="checkbox"
                id="insurance-confirm"
                checked={insuranceConfirmed}
                onChange={e => setInsuranceConfirmed(e?.target?.checked)}
                className="mt-0.5 flex-shrink-0"
              />
              <label htmlFor="insurance-confirm" className="text-xs text-amber-800 cursor-pointer">
                I confirm this outreach is for the <strong>patient-responsible balance only</strong> ({fmtCurrency(balanceAtContact)}), not the insurance-pending portion.
              </label>
            </div>
          )}

          {/* Outcome */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Outcome <span className="text-red-500">*</span></label>
            <select
              value={outcome}
              onChange={e => setOutcome(e?.target?.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select outcome…</option>
              {CONTACT_OUTCOMES?.map(o => (
                <option key={o?.value} value={o?.value}>{o?.label}</option>
              ))}
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e?.target?.value)}
              rows={3}
              placeholder="Optional staff note…"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Next Follow-Up Date */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Next Follow-Up Date</label>
            <input
              type="date"
              value={followupDate}
              onChange={e => setFollowupDate(e?.target?.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Mark Resolved */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mark-resolved"
              checked={isResolved}
              onChange={e => setIsResolved(e?.target?.checked)}
              className="flex-shrink-0"
            />
            <label htmlFor="mark-resolved" className="text-xs text-foreground cursor-pointer">
              Mark as Resolved / Paid
            </label>
          </div>

          {/* Staff identity note */}
          {!contactedByName && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-300 rounded px-3 py-2 font-medium">
              Current staff user could not be identified. Contact attempt cannot be logged until staff identity is available.
            </p>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <Icon name="AlertCircle" size={13} className="flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1.5"
            >
              {submitting && <Icon name="Loader2" size={13} className="animate-spin" />}
              Log Attempt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Contact History Drawer ───────────────────────────────────────────────────

const ContactHistoryDrawer = ({ row, onClose }) => {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const raw = await ascendApi?.getContactAttemptsByPatient(row?.patient_id, row?.location_id);
        if (cancelled) return;
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.data) ? raw?.data
          : Array.isArray(raw?.records) ? raw?.records
          : [];
        // Sort newest first
        const sorted = [...list]?.sort((a, b) => {
          const ta = new Date(a?.contacted_at || a?.contactedAt || 0)?.getTime();
          const tb = new Date(b?.contacted_at || b?.contactedAt || 0)?.getTime();
          return tb - ta;
        });
        setHistory(sorted);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load contact history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [row?.patient_id, row?.location_id]);

  const startEdit = (attempt) => {
    setEditingId(attempt?.id);
    setEditFields({
      contact_outcome:    attempt?.contact_outcome || attempt?.contactOutcome || '',
      contact_note:       attempt?.contact_note || attempt?.contactNote || '',
      next_followup_date: attempt?.next_followup_date || attempt?.nextFollowupDate || '',
      is_resolved:        attempt?.is_resolved ?? attempt?.isResolved ?? false,
    });
    setSaveError(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditFields({}); setSaveError(null); };

  const saveEdit = async (id) => {
    setSaving(true);
    setSaveError(null);
    try {
      await ascendApi?.patchContactAttempt(id, {
        contact_outcome:    editFields?.contact_outcome || undefined,
        contact_note:       editFields?.contact_note || undefined,
        next_followup_date: editFields?.next_followup_date || undefined,
        is_resolved:        editFields?.is_resolved,
      });
      // Refresh history
      const raw = await ascendApi?.getContactAttemptsByPatient(row?.patient_id, row?.location_id);
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw?.data : [];
      const sorted = [...list]?.sort((a, b) => {
        const ta = new Date(a?.contacted_at || a?.contactedAt || 0)?.getTime();
        const tb = new Date(b?.contacted_at || b?.contactedAt || 0)?.getTime();
        return tb - ta;
      });
      setHistory(sorted);
      setEditingId(null);
      setEditFields({});
    } catch (err) {
      setSaveError(err?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const methodLabel = (m) => CONTACT_METHODS?.find(x => x?.value === m)?.label || m || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e?.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Contact History</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{row?.patient_name} · {row?.office_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Icon name="Loader2" size={16} className="animate-spin" />
              Loading history…
            </div>
          )}
          {!loading && error && (
            <div className="flex items-center gap-2 text-red-600 text-sm py-6">
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}
          {!loading && !error && history?.length === 0 && (
            <p className="text-muted-foreground text-sm py-8 text-center">No contact attempts recorded yet for this patient.</p>
          )}
          {!loading && !error && history?.length > 0 && (
            <div className="space-y-4">
              {history?.map((attempt, idx) => {
                const id = attempt?.id;
                const isEditing = editingId === id;
                const contactedAt = attempt?.contacted_at || attempt?.contactedAt;
                const method = attempt?.contact_method || attempt?.contactMethod;
                const outcome = attempt?.contact_outcome || attempt?.contactOutcome;
                const byName = attempt?.contacted_by_name || attempt?.contactedByName;
                const bal = attempt?.balance_at_contact ?? attempt?.balanceAtContact;
                const followup = attempt?.next_followup_date || attempt?.nextFollowupDate;
                const note = attempt?.contact_note || attempt?.contactNote;
                const resolved = attempt?.is_resolved ?? attempt?.isResolved;

                return (
                  <div key={id || idx} className="border border-border rounded-lg p-4 space-y-2 relative">
                    {/* Timeline dot */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">
                          {contactedAt ? fmtDate(contactedAt) : '—'}
                        </span>
                        <span className="text-xs text-muted-foreground">{methodLabel(method)}</span>
                        <OutcomeBadge outcome={outcome} />
                        {resolved && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <Icon name="CheckCircle" size={10} /> Resolved
                          </span>
                        )}
                      </div>
                      {!isEditing && id && (
                        <button
                          onClick={() => startEdit(attempt)}
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 flex-shrink-0"
                        >
                          <Icon name="Pencil" size={11} /> Edit
                        </button>
                      )}
                    </div>

                    {byName && <p className="text-xs text-muted-foreground">By: {byName}</p>}
                    {bal !== undefined && bal !== null && (
                      <p className="text-xs text-muted-foreground">Balance at contact: {fmtCurrency(bal)}</p>
                    )}
                    {followup && <p className="text-xs text-muted-foreground">Follow-up: {fmtDate(followup)}</p>}
                    {note && <p className="text-xs text-foreground bg-muted/40 rounded px-2 py-1.5 mt-1">{note}</p>}

                    {/* Inline edit form */}
                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        <p className="text-xs font-semibold text-foreground">Edit Attempt</p>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Outcome</label>
                          <select
                            value={editFields?.contact_outcome || ''}
                            onChange={e => setEditFields(f => ({ ...f, contact_outcome: e?.target?.value }))}
                            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Select…</option>
                            {CONTACT_OUTCOMES?.map(o => (
                              <option key={o?.value} value={o?.value}>{o?.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Note</label>
                          <textarea
                            value={editFields?.contact_note || ''}
                            onChange={e => setEditFields(f => ({ ...f, contact_note: e?.target?.value }))}
                            rows={2}
                            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Next Follow-Up Date</label>
                          <input
                            type="date"
                            value={editFields?.next_followup_date || ''}
                            onChange={e => setEditFields(f => ({ ...f, next_followup_date: e?.target?.value }))}
                            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`resolved-edit-${id}`}
                            checked={editFields?.is_resolved || false}
                            onChange={e => setEditFields(f => ({ ...f, is_resolved: e?.target?.checked }))}
                          />
                          <label htmlFor={`resolved-edit-${id}`} className="text-xs text-foreground cursor-pointer">Mark Resolved</label>
                        </div>
                        {saveError && (
                          <p className="text-xs text-red-600">{saveError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(id)}
                            disabled={saving}
                            className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1"
                          >
                            {saving && <Icon name="Loader2" size={11} className="animate-spin" />}
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Expanded Row Detail ──────────────────────────────────────────────────────

const ExpandedDetail = ({ row, onLogAttempt, onViewHistory }) => {
  const reasons = deriveReadinessReason(row);
  const hasDentrixHistory = (row?.dentrix_statement_count || 0) > 0;

  return (
    <tr className="bg-muted/30">
      <td colSpan={TOTAL_COLS} className="px-6 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Charges / Payments</p>
            <p className="text-foreground">{fmtCurrency(row?.charges)} / {fmtCurrency(row?.payments)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Insurance Paid</p>
            <p className="text-foreground">{fmtCurrency(row?.insurance_paid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Adjustments</p>
            <p className="text-foreground">{fmtCurrency(row?.adjustments)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Bucket Breakdown</p>
            <p className="text-foreground text-xs">
              Curr: {fmtCurrency(row?.bucket_current)} · 31-60: {fmtCurrency(row?.bucket_30)} · 61-90: {fmtCurrency(row?.bucket_60)} · 90+: {fmtCurrency(row?.bucket_90)}
            </p>
          </div>
          {row?.claim_id && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Claim ID</p>
              <p className="text-foreground font-mono text-xs">{row?.claim_id}</p>
            </div>
          )}
          {row?.claim_followup_action && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Follow-up Action</p>
              <p className="text-foreground">{row?.claim_followup_action}</p>
            </div>
          )}
          {row?.primary_guarantor_id && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Primary Guarantor ID</p>
              <p className="text-foreground font-mono text-xs">{row?.primary_guarantor_id}</p>
            </div>
          )}
          {row?.is_self_guarantor !== null && row?.is_self_guarantor !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Self-Guarantor</p>
              <p className="text-foreground">{row?.is_self_guarantor ? 'Yes' : 'No'}</p>
            </div>
          )}

          {/* Contact Readiness Detail */}
          <div className="col-span-full pt-2 border-t border-border">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <Icon name="Info" size={13} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">
                  Contact Readiness: <ContactReadinessBadge status={row?.contact_readiness} />
                </p>
                {reasons?.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {reasons?.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                        <span className="mt-0.5 text-muted-foreground/50">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Phase 1C: Contact attempt summary in expanded detail */}
          {(row?.last_contacted_at || row?.attempt_count > 0) && (
            <div className="col-span-full pt-2 border-t border-border">
              <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Icon name="Phone" size={12} className="text-teal-500" />
                Contact Attempt Summary
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">Last Contacted</p>
                  <p className="text-foreground font-medium">{row?.last_contacted_at ? fmtDate(row?.last_contacted_at) : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Last Outcome</p>
                  <OutcomeBadge outcome={row?.last_contact_outcome} />
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Attempts</p>
                  <p className="text-foreground font-medium">{row?.attempt_count || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Next Follow-Up</p>
                  <p className="text-foreground font-medium">{row?.next_followup_date ? fmtDate(row?.next_followup_date) : '—'}</p>
                </div>
                {row?.contacted_by_name && (
                  <div>
                    <p className="text-muted-foreground mb-0.5">Last By</p>
                    <p className="text-foreground">{row?.contacted_by_name}</p>
                  </div>
                )}
                {row?.last_contact_note && (
                  <div className="col-span-full">
                    <p className="text-muted-foreground mb-0.5">Last Note</p>
                    <p className="text-foreground bg-muted/40 rounded px-2 py-1">{row?.last_contact_note}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Phase 2A: Outreach Outcome section */}
          <div className="col-span-full pt-2 border-t border-border">
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Icon name="BarChart2" size={12} className="text-violet-500" />
              Outreach Outcome
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5">Outcome Status</p>
                <OutcomeStatusBadge status={row?.outcome_status} />
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Outreach Anchor Date</p>
                <p className="text-foreground font-medium">{row?.outreach_anchor_date ? fmtDate(row?.outreach_anchor_date) : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Days Since Outreach</p>
                <p className="text-foreground font-medium">
                  {row?.days_since_last_outreach !== null && row?.days_since_last_outreach !== undefined
                    ? `${row?.days_since_last_outreach}d`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Contacted By</p>
                <p className="text-foreground">{row?.contacted_by_name || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Attempt Count</p>
                <p className="text-foreground font-medium">{row?.attempt_count || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Payment Activity After Outreach</p>
                <p className={`font-medium ${row?.payment_after_outreach ? 'text-teal-700' : 'text-muted-foreground'}`}>
                  {row?.payment_after_outreach ? 'Yes' : 'No'}
                </p>
              </div>
              {row?.payment_after_outreach && (
                <>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Last Payment Date</p>
                    <p className="text-foreground font-medium">{row?.last_payment_date ? fmtDate(row?.last_payment_date) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Last Payment Amount</p>
                    <p className="text-foreground font-medium">{row?.last_payment_amount ? fmtCurrency(row?.last_payment_amount) : '—'}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-muted-foreground mb-0.5">Follow-Up Due</p>
                <p className={`font-medium ${row?.followup_due ? 'text-amber-700' : 'text-muted-foreground'}`}>
                  {row?.followup_due ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Needs Second Attempt</p>
                <p className={`font-medium ${row?.needs_second_attempt ? 'text-red-700' : 'text-muted-foreground'}`}>
                  {row?.needs_second_attempt ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Still Open After Outreach</p>
                <p className={`font-medium ${row?.still_open_after_outreach ? 'text-orange-700' : 'text-muted-foreground'}`}>
                  {row?.still_open_after_outreach ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>

          {/* Phase 1D: Dentrix Statement History section */}
          <div className="col-span-full pt-2 border-t border-border">
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Icon name="FileText" size={12} className="text-indigo-500" />
              Dentrix Statement History
            </p>
            {hasDentrixHistory ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">Statement Count</p>
                  <p className="text-foreground font-medium">{row?.dentrix_statement_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Last Statement Date</p>
                  <p className="text-foreground font-medium">{row?.dentrix_last_statement_date ? fmtDate(row?.dentrix_last_statement_date) : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Delivery Method</p>
                  <p className="text-foreground font-medium">{row?.dentrix_last_delivery_method || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Statement Type</p>
                  <p className="text-foreground font-medium">{row?.dentrix_last_statement_type || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Patient Portion</p>
                  <p className="text-foreground font-medium">
                    {row?.dentrix_last_patient_portion != null ? fmtCurrency(row?.dentrix_last_patient_portion) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Please Pay</p>
                  <p className="text-foreground font-medium">
                    {row?.dentrix_last_please_pay != null ? fmtCurrency(row?.dentrix_last_please_pay) : '—'}
                  </p>
                </div>
                {row?.dentrix_document_ids && (
                  <div className="col-span-full">
                    <p className="text-muted-foreground mb-0.5">Document IDs</p>
                    <p className="text-foreground font-mono text-xs break-all">
                      {Array.isArray(row?.dentrix_document_ids)
                        ? row?.dentrix_document_ids?.join(', ')
                        : String(row?.dentrix_document_ids)}
                    </p>
                  </div>
                )}
                <div className="col-span-full">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-1">
                    Dentrix statement amounts shown here use patientPortion / pleasePay. totalBalance is reference only and must not be used for patient outreach.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No Dentrix statement history found for this patient.</p>
            )}
          </div>

          {/* Action buttons in expanded detail */}
          <div className="col-span-full pt-2 border-t border-border space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={e => { e?.stopPropagation(); onLogAttempt?.(); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90"
              >
                <Icon name="Phone" size={12} />
                Log Attempt
              </button>
              <button
                onClick={e => { e?.stopPropagation(); onViewHistory?.(); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                <Icon name="History" size={12} />
                View History
              </button>
              <OpenDentrixLedgerButton patientId={row?.patient_id} size="sm" />
            </div>
            <p className="text-xs text-muted-foreground/70 italic">
              Opens Dentrix Ascend ledger. Staff must send Request To Pay / eStatement inside Dentrix, then log the attempt here.
            </p>
          </div>

          <div className="col-span-full pt-1">
            <p className="text-xs text-muted-foreground italic">
              Copy actions only — statement and payment link sending is not enabled yet.
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PatientStatementsTab = ({ dateRange, officeId, refreshKey }) => {
  const { user: currentUser, userProfile } = useAuth();

  const [allRows, setAllRows]                       = useState([]);
  const [loading, setLoading]                       = useState(true);
  const [error, setError]                           = useState(null);
  const [contactSummaryError, setContactSummaryError] = useState(false);
  const [dentrixSummaryError, setDentrixSummaryError] = useState(false);
  const [search, setSearch]                         = useState('');
  const [activeChip, setActiveChip]                 = useState('all');
  const [sortKey, setSortKey]                       = useState('balance');
  const [sortDir, setSortDir]                       = useState('desc');
  const [page, setPage]                             = useState(1);
  const [pageSize]                                  = useState(30);
  const [expandedId, setExpandedId]                 = useState(null);
  const [logAttemptRow, setLogAttemptRow]           = useState(null);
  const [historyRow, setHistoryRow]                 = useState(null);

  // ── Data fetch: AR aging + contact summary + Dentrix outreach summary ───────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setContactSummaryError(false);
    setDentrixSummaryError(false);
    setPage(1);
    setExpandedId(null);
    try {
      let records = [];

      if (officeId) {
        // Single office selected
        const locationId = resolveLocationId(officeId);
        const officeName = OFFICE_MAP?.[officeId]?.name || '—';
        records = await fetchAllPagesForLocation(dateRange?.start, dateRange?.end, locationId, officeName);
      } else {
        // All Offices — fan out to all 4
        const results = await Promise.allSettled(
          ALL_OFFICES?.map(o =>
            fetchAllPagesForLocation(dateRange?.start, dateRange?.end, o?.locationId, o?.officeName)
          )
        );
        results?.forEach(r => {
          if (r?.status === 'fulfilled') records?.push(...r?.value);
        });
      }

      const locationId = officeId ? resolveLocationId(officeId) : null;

      // Phase 1C: Fetch contact-attempt summary (non-blocking)
      try {
        const summaryRaw = await ascendApi?.getContactAttemptSummary(
          dateRange?.start,
          dateRange?.end,
          locationId
        );
        const summaryList = normalizeContactSummary(summaryRaw);
        if (summaryList?.length > 0) {
          records = mergeContactSummary(records, summaryList);
        }
      } catch (summaryErr) {
        console.warn('[PatientStatementsTab] Contact summary fetch failed (non-fatal):', summaryErr?.message);
        setContactSummaryError(true);
      }

      // Phase 1D: Fetch patient-balance-outreach-summary (non-blocking)
      // This endpoint merges Dentrix statement history + contact attempts
      try {
        const outreachRaw = await ascendApi?.getPatientBalanceOutreachSummary(
          dateRange?.start,
          dateRange?.end,
          locationId
        );
        const outreachList = normalizeContactSummary(outreachRaw);
        if (outreachList?.length > 0) {
          records = mergeContactSummary(records, outreachList);
        }
      } catch (dentrixErr) {
        console.warn('[PatientStatementsTab] Dentrix outreach summary fetch failed (non-fatal):', dentrixErr?.message);
        setDentrixSummaryError(true);
      }

      setAllRows(records);
    } catch (e) {
      setError(e?.message || 'Unable to load patient balances from AR Aging.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [dateRange?.start, dateRange?.end, officeId, refreshKey]);

  useEffect(() => { loadData(); }, [loadData]);

  // After logging an attempt, refresh contact summary only (not full AR aging)
  const refreshContactSummary = useCallback(async () => {
    try {
      const locationId = officeId ? resolveLocationId(officeId) : null;
      const summaryRaw = await ascendApi?.getContactAttemptSummary(
        dateRange?.start,
        dateRange?.end,
        locationId
      );
      const summaryList = normalizeContactSummary(summaryRaw);
      setAllRows(prev => mergeContactSummary(prev, summaryList));
    } catch (err) {
      console.warn('[PatientStatementsTab] Contact summary refresh failed:', err?.message);
    }
  }, [dateRange?.start, dateRange?.end, officeId]);

  // ── Chip filter ─────────────────────────────────────────────────────────────
  const chipFiltered = useMemo(() => {
    const now = new Date();
    const cutoff14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const today = now?.toISOString()?.slice(0, 10);
    const currentUserName = userProfile?.full_name || userProfile?.display_name || userProfile?.username || currentUser?.email || null;
    const currentUserId = currentUser?.id || null;
    return allRows?.filter(r => {
      switch (activeChip) {
        case 'over90':
          return (r?.days_outstanding || 0) >= 90;
        case 'insurance': {
          const cs = String(r?.collection_status || '')?.toUpperCase();
          return ACTIVE_INSURANCE_STATUSES?.some(s => cs?.includes(s));
        }
        case 'selfpay':
          return !r?.claim_id && !r?.payor_name;
        case 'recent_payment': {
          if (!r?.last_payment_date) return false;
          const lpd = new Date(r.last_payment_date);
          return lpd >= cutoff14 && (r?.balance || 0) > 0;
        }
        case 'high_balance':
          return (r?.balance || 0) > 1000;
        case 'active_only':
          return String(r?.patient_status || '')?.toUpperCase() === 'ACTIVE';
        case 'ready_to_contact':
          return r?.contact_readiness === 'Ready to Contact';
        case 'needs_review':
          return r?.contact_readiness === 'Needs Review';
        case 'no_contact_info':
          return r?.contact_readiness === 'No Contact Info';
        // Phase 1C chips
        case 'not_yet_contacted':
          return !r?.last_contacted_at;
        case 'followup_needed':
          return r?.last_contact_outcome === 'FOLLOW_UP_NEEDED' ||
            (r?.next_followup_date && r?.next_followup_date <= today);
        case 'resolved_paid':
          return r?.is_resolved === true || RESOLVED_OUTCOMES?.includes(r?.last_contact_outcome);
        case 'dentrix_stmt_sent':
          return r?.last_contact_method === 'STATEMENT_DENTRIX';
        // Phase 1D chips
        case 'dentrix_stmt_exists':
          return (r?.dentrix_statement_count || 0) > 0;
        case 'no_dentrix_stmt':
          return !(r?.dentrix_statement_count);
        case 'recent_dentrix_stmt': {
          if (!r?.dentrix_last_statement_date) return false;
          return new Date(r?.dentrix_last_statement_date) >= cutoff30;
        }
        case 'dentrix_electronic': {
          const dm = String(r?.dentrix_last_delivery_method || r?.dentrix_delivery_methods || '')?.toUpperCase();
          return dm?.includes('ELECTRONIC');
        }
        case 'dentrix_print': {
          const dm = String(r?.dentrix_last_delivery_method || r?.dentrix_delivery_methods || '')?.toUpperCase();
          return dm?.includes('PRINT');
        }
        // Phase 2A chips
        case 'payment_after_outreach':
          return r?.payment_after_outreach === true;
        case 'followup_due':
          return r?.followup_due === true;
        case 'still_open_after_outreach':
          return r?.still_open_after_outreach === true;
        case 'needs_second_attempt':
          return r?.needs_second_attempt === true;
        case 'my_followups': {
          const byId = r?.contacted_by === currentUserId;
          const byName = currentUserName && r?.contacted_by_name === currentUserName;
          return (byId || byName) && r?.followup_due === true;
        }
        case 'staff_review':
          return !r?.contacted_by_name ||
            r?.outcome_status === 'Needs Review' ||
            r?.contact_readiness === 'Needs Review';
        default:
          return true;
      }
    });
  }, [allRows, activeChip, currentUser, userProfile]);

  // ── Search filter ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search?.toLowerCase();
    if (!q) return chipFiltered;
    return chipFiltered?.filter(r =>
      r?.patient_name?.toLowerCase()?.includes(q) ||
      r?.patient_id?.toLowerCase()?.includes(q) ||
      r?.chart_number?.toLowerCase()?.includes(q) ||
      r?.office_name?.toLowerCase()?.includes(q) ||
      r?.provider_name?.toLowerCase()?.includes(q)
    );
  }, [chipFiltered, search]);

  // ── Scorecards ──────────────────────────────────────────────────────────────
  const scorecards = useMemo(() => {
    const source = (activeChip === 'all' && !search?.trim()) ? allRows : filtered;
    if (!source?.length) return null;
    const n = source?.length;
    const totalBalance   = source?.reduce((s, r) => s + (r?.balance || 0), 0);
    const sumCurrent     = source?.reduce((s, r) => s + (r?.bucket_current || 0), 0);
    const sum30          = source?.reduce((s, r) => s + (r?.bucket_30 || 0), 0);
    const sum60          = source?.reduce((s, r) => s + (r?.bucket_60 || 0), 0);
    const sum90          = source?.reduce((s, r) => s + (r?.bucket_90 || 0), 0);
    const avgDays        = n > 0 ? Math.round(source?.reduce((s, r) => s + (r?.days_outstanding || 0), 0) / n) : 0;
    const hasMobile      = source?.filter(r => r?.has_mobile_phone)?.length;
    const hasEmail       = source?.filter(r => r?.has_email)?.length;
    // Phase 1C scorecard counts
    const today = new Date()?.toISOString()?.slice(0, 10);
    const notYetContacted = source?.filter(r => !r?.last_contacted_at)?.length;
    const followupNeeded  = source?.filter(r =>
      r?.last_contact_outcome === 'FOLLOW_UP_NEEDED' ||
      (r?.next_followup_date && r?.next_followup_date <= today)
    )?.length;
    const resolvedCount   = source?.filter(r =>
      r?.is_resolved === true || RESOLVED_OUTCOMES?.includes(r?.last_contact_outcome)
    )?.length;
    // Phase 1D scorecard counts
    const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const withDentrixStmt   = source?.filter(r => (r?.dentrix_statement_count || 0) > 0)?.length;
    const noDentrixStmt     = source?.filter(r => !(r?.dentrix_statement_count))?.length;
    const recentDentrixStmt = source?.filter(r =>
      r?.dentrix_last_statement_date && new Date(r?.dentrix_last_statement_date) >= cutoff30
    )?.length;
    // Phase 2A outcome scorecard counts
    const outcomeNotContacted       = source?.filter(r => r?.outcome_status === 'Not Contacted')?.length;
    const outcomeFollowupDue        = source?.filter(r => r?.outcome_status === 'Follow-Up Due')?.length;
    const outcomePaymentAfter       = source?.filter(r => r?.outcome_status === 'Payment Activity After Outreach')?.length;
    const outcomeStillOpen          = source?.filter(r => r?.outcome_status === 'Still Open After Outreach')?.length;
    const outcomeNeedsSecond        = source?.filter(r => r?.outcome_status === 'Needs Second Attempt')?.length;
    const outcomeResolved           = source?.filter(r => r?.outcome_status === 'Resolved / Paid')?.length;
    return {
      n, totalBalance, sumCurrent, sum30, sum60, sum90, avgDays, hasMobile, hasEmail,
      notYetContacted, followupNeeded, resolvedCount,
      withDentrixStmt, noDentrixStmt, recentDentrixStmt,
      outcomeNotContacted, outcomeFollowupDue, outcomePaymentAfter,
      outcomeStillOpen, outcomeNeedsSecond, outcomeResolved,
    };
  }, [allRows, filtered, activeChip, search]);

  // ── Phase 2A: Staff Activity panel data ─────────────────────────────────────
  const staffActivity = useMemo(() => {
    const source = (activeChip === 'all' && !search?.trim()) ? allRows : filtered;
    if (!source?.length) return [];
    const map = {};
    source?.forEach(r => {
      const name = r?.contacted_by_name || 'Unknown Staff';
      if (!map?.[name]) {
        map[name] = { name, attemptCount: 0, followupDueCount: 0, resolvedCount: 0 };
      }
      if (r?.attempt_count > 0) map[name].attemptCount += r?.attempt_count;
      if (r?.followup_due) map[name].followupDueCount += 1;
      if (r?.outcome_status === 'Resolved / Paid') map[name].resolvedCount += 1;
    });
    return Object.values(map)
      ?.filter(s => s?.attemptCount > 0 || s?.followupDueCount > 0 || s?.resolvedCount > 0)
      ?.sort((a, b) => b?.attemptCount - a?.attemptCount)
      ?.slice(0, 10);
  }, [allRows, filtered, activeChip, search]);

  // ── Sort ────────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered]?.sort((a, b) => {
      const av = a?.[sortKey] ?? '';
      const bv = b?.[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av)?.localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted?.length / pageSize));
  const paginated  = sorted?.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleChip = (id) => { setActiveChip(id); setPage(1); };

  const handleExport = () => {
    downloadCsv(
      `patient-balances-${dateRange?.start}-${dateRange?.end}.csv`,
      rowsToCsv(sorted, COLUMNS)
    );
  };

  const handleLogAttemptSuccess = async () => {
    setLogAttemptRow(null);
    await refreshContactSummary();
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* AR Source Note */}
      {!loading && !error && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
          <Icon name="Info" size={13} className="flex-shrink-0 mt-0.5 text-blue-500" />
          <span>Balances are Dentrix AR Aging totals by patient/office and may include insurance-pending portions. True patient-responsible balances will be shown in a separate Patient Balances tab.</span>
        </div>
      )}
      {/* Scorecards */}
      {!loading && !error && scorecards && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Icon name="Filter" size={12} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground italic">Scorecards reflect current filters.</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <ScoreCard label="Patients w/ AR Balance" value={scorecards?.n?.toLocaleString()} color="blue" />
            <ScoreCard label="Total Patient-Level AR" value={fmtCurrency(scorecards?.totalBalance)} color="red" />
            <ScoreCard label="Current (0–30)" value={fmtCurrency(scorecards?.sumCurrent)} color="green" />
            <ScoreCard label="31–60 Days" value={fmtCurrency(scorecards?.sum30)} color="amber" />
            <ScoreCard label="61–90 Days" value={fmtCurrency(scorecards?.sum60)} color="amber" />
            <ScoreCard label="Over 90 Days" value={fmtCurrency(scorecards?.sum90)} color="red" />
            <ScoreCard label="Avg Days Outstanding" value={`${scorecards?.avgDays}d`} color="purple" />
            <ScoreCard
              label="Has Mobile"
              value={scorecards?.hasMobile?.toLocaleString()}
              sub={scorecards?.n > 0 ? `${Math.round((scorecards?.hasMobile / scorecards?.n) * 100)}% of patients` : ''}
              color="default"
            />
            <ScoreCard
              label="Has Email"
              value={scorecards?.hasEmail?.toLocaleString()}
              sub={scorecards?.n > 0 ? `${Math.round((scorecards?.hasEmail / scorecards?.n) * 100)}% of patients` : ''}
              color="default"
            />
            {/* Phase 1C scorecard counts */}
            <ScoreCard label="Not Yet Contacted" value={scorecards?.notYetContacted?.toLocaleString()} color="default" />
            <ScoreCard label="Follow-Up Needed" value={scorecards?.followupNeeded?.toLocaleString()} color="amber" />
            <ScoreCard label="Resolved / Paid" value={scorecards?.resolvedCount?.toLocaleString()} color="teal" />
            {/* Phase 1D scorecard counts */}
            <ScoreCard label="Patients w/ Dentrix Statement" value={scorecards?.withDentrixStmt?.toLocaleString()} color="indigo" />
            <ScoreCard label="No Dentrix Statement" value={scorecards?.noDentrixStmt?.toLocaleString()} color="default" />
            <ScoreCard label="Recent Dentrix Statement" value={scorecards?.recentDentrixStmt?.toLocaleString()} color="indigo" />
            {/* Phase 2A outcome scorecards */}
            <ScoreCard label="Not Contacted" value={scorecards?.outcomeNotContacted?.toLocaleString()} color="default" />
            <ScoreCard label="Follow-Up Due" value={scorecards?.outcomeFollowupDue?.toLocaleString()} color="amber" />
            <ScoreCard label="Payment Activity After Outreach" value={scorecards?.outcomePaymentAfter?.toLocaleString()} color="teal" />
            <ScoreCard label="Still Open After Outreach" value={scorecards?.outcomeStillOpen?.toLocaleString()} color="amber" />
            <ScoreCard label="Needs Second Attempt" value={scorecards?.outcomeNeedsSecond?.toLocaleString()} color="red" />
            <ScoreCard label="Resolved / Paid (Outcome)" value={scorecards?.outcomeResolved?.toLocaleString()} color="green" />
          </div>
        </div>
      )}
      {/* Phase 2A: Staff Activity Panel */}
      {!loading && !error && staffActivity?.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Icon name="Users" size={13} className="text-violet-500" />
            <span className="text-xs font-semibold text-foreground">Staff Activity</span>
            <span className="text-xs text-muted-foreground ml-1">(computed from current filters)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-4 text-muted-foreground font-medium">Staff</th>
                  <th className="text-right py-1.5 px-3 text-muted-foreground font-medium">Attempts</th>
                  <th className="text-right py-1.5 px-3 text-muted-foreground font-medium">Follow-Up Due</th>
                  <th className="text-right py-1.5 pl-3 text-muted-foreground font-medium">Resolved / Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staffActivity?.map((s, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="py-1.5 pr-4 font-medium text-foreground">
                      {s?.name === 'Unknown Staff'
                        ? <span className="text-muted-foreground italic">{s?.name}</span>
                        : s?.name}
                    </td>
                    <td className="text-right py-1.5 px-3 text-foreground">{s?.attemptCount}</td>
                    <td className="text-right py-1.5 px-3">
                      {s?.followupDueCount > 0
                        ? <span className="text-amber-700 font-semibold">{s?.followupDueCount}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="text-right py-1.5 pl-3">
                      {s?.resolvedCount > 0
                        ? <span className="text-emerald-700 font-semibold">{s?.resolvedCount}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Contact summary warning (non-fatal) */}
      {!loading && contactSummaryError && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
          <Icon name="AlertCircle" size={13} className="flex-shrink-0 text-amber-500" />
          Patient balances loaded. Contact attempt history could not be loaded.
        </div>
      )}
      {/* Phase 1D: Dentrix summary warning (non-fatal) */}
      {!loading && dentrixSummaryError && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
          <Icon name="AlertCircle" size={13} className="flex-shrink-0 text-amber-500" />
          Patient balances loaded. Dentrix statement history could not be loaded. Outcome analytics may be incomplete.
        </div>
      )}
      {/* Main table card */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border space-y-3">
          {/* Search + Export */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search patient, chart #, office, provider..."
                value={search}
                onChange={e => { setSearch(e?.target?.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
              />
            </div>
            <button
              onClick={handleExport}
              disabled={loading || sorted?.length === 0}
              className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted disabled:opacity-40"
            >
              <Icon name="Download" size={14} /> Export CSV
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS?.map(chip => (
              <button
                key={chip?.id}
                onClick={() => handleChip(chip?.id)}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                  activeChip === chip?.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {chip?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[2400px]">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-3 py-3 w-8" />
                {COLUMNS?.map(col => (
                  <th
                    key={col?.key}
                    onClick={() => handleSort(col?.key)}
                    className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground whitespace-nowrap"
                  >
                    {col?.label}
                    <SortIcon col={col?.key} sortKey={sortKey} sortDir={sortDir} />
                  </th>
                ))}
                {/* Log Attempt column header */}
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading
                ? Array.from({ length: 6 })?.map((_, i) => <SkeletonRow key={i} />)
                : error
                ? (
                  <tr>
                    <td colSpan={TOTAL_COLS} className="px-4 py-10 text-center text-red-500 text-sm">
                      <Icon name="AlertCircle" size={16} className="inline mr-2" />
                      Unable to load patient balances from AR Aging.
                    </td>
                  </tr>
                )
                : paginated?.length === 0
                ? (
                  <tr>
                    <td colSpan={TOTAL_COLS} className="px-4 py-14 text-center text-muted-foreground text-sm">
                      No outstanding patient balances found for the selected filters.
                    </td>
                  </tr>
                )
                : paginated?.map(row => {
                  const isExpanded = expandedId === row?._id;
                  return (
                    <React.Fragment key={row?._id}>
                      <tr
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : row?._id)}
                      >
                        {/* Expand toggle */}
                        <td className="px-3 py-2.5 text-muted-foreground">
                          <Icon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} size={14} />
                        </td>
                        {/* Patient Name */}
                        <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                          {row?.patient_name}
                          <CopyButton value={row?.patient_id} label="Patient ID" />
                        </td>
                        {/* Chart # */}
                        <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">
                          {row?.chart_number}
                          <CopyButton value={row?.chart_number} label="Chart #" />
                        </td>
                        {/* Office */}
                        <td className="px-3 py-2.5 text-card-foreground">{row?.office_name}</td>
                        {/* Balance */}
                        <td className="px-3 py-2.5 font-semibold text-foreground">{fmtCurrency(row?.balance)}</td>
                        {/* Aging Bucket */}
                        <td className="px-3 py-2.5"><AgingBadge bucket={row?.aging_bucket} /></td>
                        {/* Days Outstanding */}
                        <td className="px-3 py-2.5"><DaysColor days={row?.days_outstanding} /></td>
                        {/* Last Payment Date */}
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                          {row?.last_payment_date ? fmtDate(row?.last_payment_date) : '—'}
                        </td>
                        {/* Last Payment Amount */}
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {row?.last_payment_amount ? fmtCurrency(row?.last_payment_amount) : '—'}
                        </td>
                        {/* Provider */}
                        <td className="px-3 py-2.5 text-card-foreground">{row?.provider_name}</td>
                        {/* Payor / Plan */}
                        <td className="px-3 py-2.5 text-muted-foreground">
                          <div>{row?.payor_name || '—'}</div>
                          {row?.plan_name && <div className="text-xs text-muted-foreground/70">{row?.plan_name}</div>}
                        </td>
                        {/* Claim Status */}
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{row?.collection_status || '—'}</td>
                        {/* Mobile */}
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap" onClick={e => e?.stopPropagation()}>
                          {row?.mobile_phone
                            ? <span className="flex items-center gap-1">{row?.mobile_phone}<CopyButton value={row?.mobile_phone} label="phone" /></span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Email */}
                        <td className="px-3 py-2.5 text-muted-foreground" onClick={e => e?.stopPropagation()}>
                          {row?.email
                            ? <span className="flex items-center gap-1 max-w-[160px] truncate">{row?.email}<CopyButton value={row?.email} label="email" /></span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Contact Pref */}
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{row?.contact_preference || '—'}</td>
                        {/* Patient Status */}
                        <td className="px-3 py-2.5">
                          {row?.patient_status
                            ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${String(row?.patient_status)?.toUpperCase() === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>{row?.patient_status}</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Contact Readiness */}
                        <td className="px-3 py-2.5">
                          <ContactReadinessBadge status={row?.contact_readiness} />
                        </td>
                        {/* Phase 1C: Last Contact */}
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                          {row?.last_contacted_at ? (
                            <div>
                              <div>{fmtDate(row?.last_contacted_at)}</div>
                              {row?.last_contact_method && (
                                <div className="text-muted-foreground/60 text-xs">
                                  {CONTACT_METHODS?.find(m => m?.value === row?.last_contact_method)?.label || row?.last_contact_method}
                                </div>
                              )}
                            </div>
                          ) : <span className="text-muted-foreground/40">Not contacted</span>}
                        </td>
                        {/* Phase 1C: Contact Outcome */}
                        <td className="px-3 py-2.5">
                          <OutcomeBadge outcome={row?.last_contact_outcome} />
                        </td>
                        {/* Phase 1C: Attempt Count */}
                        <td className="px-3 py-2.5 text-center">
                          {row?.attempt_count > 0
                            ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">{row?.attempt_count}</span>
                            : <span className="text-muted-foreground/40 text-xs">0</span>}
                        </td>
                        {/* Phase 1C: Next Follow-Up */}
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                          {row?.next_followup_date ? (
                            <span className={row?.next_followup_date <= new Date()?.toISOString()?.slice(0, 10) ? 'text-amber-600 font-semibold' : ''}>
                              {fmtDate(row?.next_followup_date)}
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 1C: Last Contacted By */}
                        <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                          {row?.contacted_by_name || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 1D: Dentrix Statements count */}
                        <td className="px-3 py-2.5 text-center">
                          {(row?.dentrix_statement_count || 0) > 0
                            ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">{row?.dentrix_statement_count}</span>
                            : <span className="text-muted-foreground/40 text-xs">0</span>}
                        </td>
                        {/* Phase 1D: Last Dentrix Statement date */}
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                          {row?.dentrix_last_statement_date
                            ? fmtDate(row?.dentrix_last_statement_date)
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 1D: Dentrix Delivery Method */}
                        <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                          {row?.dentrix_last_delivery_method || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 1D: Last Patient Portion */}
                        <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                          {row?.dentrix_last_patient_portion != null
                            ? fmtCurrency(row?.dentrix_last_patient_portion)
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 1D: Last Please Pay */}
                        <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                          {row?.dentrix_last_please_pay != null
                            ? fmtCurrency(row?.dentrix_last_please_pay)
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 2A: Outcome Status */}
                        <td className="px-3 py-2.5">
                          <OutcomeStatusBadge status={row?.outcome_status} />
                        </td>
                        {/* Phase 2A: Days Since Outreach */}
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {row?.days_since_last_outreach !== null && row?.days_since_last_outreach !== undefined
                            ? <span className={
                                row?.days_since_last_outreach >= 30 ? 'text-red-600 font-semibold' :
                                row?.days_since_last_outreach >= 14 ? 'text-amber-600 font-semibold': 'text-muted-foreground'
                              }>{row?.days_since_last_outreach}d</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 2A: Outreach Anchor Date (CSV only, minimal table display) */}
                        <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                          {row?.outreach_anchor_date ? fmtDate(row?.outreach_anchor_date) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 2A: Payment After Outreach */}
                        <td className="px-3 py-2.5 text-xs text-center">
                          {row?.payment_after_outreach
                            ? <span className="inline-flex items-center gap-0.5 text-teal-700 font-semibold"><Icon name="TrendingUp" size={11} />Yes</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 2A: Still Open After Outreach */}
                        <td className="px-3 py-2.5 text-xs text-center">
                          {row?.still_open_after_outreach
                            ? <span className="text-orange-700 font-semibold">Yes</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 2A: Follow-Up Due */}
                        <td className="px-3 py-2.5 text-xs text-center">
                          {row?.followup_due
                            ? <span className="text-amber-700 font-semibold">Yes</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Phase 2A: Needs Second Attempt */}
                        <td className="px-3 py-2.5 text-xs text-center">
                          {row?.needs_second_attempt
                            ? <span className="text-red-700 font-semibold">Yes</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        {/* Actions column: Log Attempt + Open Dentrix Ledger */}
                        <td className="px-3 py-2.5" onClick={e => e?.stopPropagation()}>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => setLogAttemptRow(row)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors whitespace-nowrap"
                            >
                              <Icon name="Phone" size={11} />
                              Log Attempt
                            </button>
                            <OpenDentrixLedgerButton patientId={row?.patient_id} size="xs" />
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <ExpandedDetail
                          row={row}
                          onLogAttempt={() => setLogAttemptRow(row)}
                          onViewHistory={() => setHistoryRow(row)}
                        />
                      )}
                    </React.Fragment>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {loading ? 'Loading…' : `${page} of ${totalPages} pages (${sorted?.length} of ${allRows?.length} total)`}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="p-1.5 rounded hover:bg-muted disabled:opacity-40">
                <Icon name="ChevronLeft" size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading} className="p-1.5 rounded hover:bg-muted disabled:opacity-40">
                <Icon name="ChevronRight" size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <Icon name="Info" size={12} className="text-blue-400 flex-shrink-0" />
            <span>
              Source: Dentrix-backed AR Aging via /v2/rcm/ar-aging. Contact attempts via /v2/rcm/contact-attempts. Dentrix statement history is read from /v2/rcm/dentrix-statements. Patient outreach amounts use patientPortion / pleasePay only. Balances represent total unresolved AR by patient/office and may include insurance-pending portions. True patient-responsible balances will be shown in a separate Patient Balances tab.
            </span>
          </div>
          {/* Phase 2A: Outcome analytics definition note */}
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground/60 border-t border-border pt-2">
            <Icon name="BarChart2" size={12} className="text-violet-400 flex-shrink-0 mt-0.5" />
            <span>
              Outcome analytics compare current AR balance, dashboard contact attempts, Dentrix statement history, and last payment date. Payment Activity After Outreach does not necessarily mean the balance is fully paid.
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground/60">
            <Icon name="AlertCircle" size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <span>Contact readiness is a workflow aid only. Staff should verify balance and contact details before patient outreach. Log Attempt records outreach activity only — no SMS, email, or payment actions are triggered.</span>
          </div>
        </div>
      </div>
      {/* Log Attempt Modal */}
      {logAttemptRow && (
        <LogAttemptModal
          row={logAttemptRow}
          currentUser={currentUser}
          userProfile={userProfile}
          onClose={() => setLogAttemptRow(null)}
          onSuccess={handleLogAttemptSuccess}
        />
      )}
      {/* Contact History Drawer */}
      {historyRow && (
        <ContactHistoryDrawer
          row={historyRow}
          onClose={() => setHistoryRow(null)}
        />
      )}
    </div>
  );
};

export default PatientStatementsTab;
