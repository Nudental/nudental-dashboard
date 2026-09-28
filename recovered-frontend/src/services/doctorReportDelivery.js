import { supabase } from '../lib/supabase';
import { readLedgerReport } from './compensationLedgerService';

export const doctorReportFilename = (doctor, payday, extension = 'pdf') =>
  `${doctor.provider_name.replace(/[^a-zA-Z0-9_-]/g, '_')}-compensation-${payday}.${extension}`;

// Uses the same authenticated sender as hygienist reports. The attachment must
// come from the selected, provider-scoped saved calculation; never a local PDF.
export async function sendDoctorReport({ options, doctor, recipient, period, confirmed },
  { read = readLedgerReport, client = supabase, encode = btoa } = {}) {
  if (!confirmed || !options.snapshot || options.providerId !== doctor.provider_id) throw new Error('Review and confirm this provider report before sending.');
  const contactResponse = await read({ ...options, format: 'ledger-recipient' });
  if (contactResponse.status !== 200) throw new Error('The saved report is not ready.');
  const contact = await contactResponse.json();
  if (!recipient || !contact.found || contact.email !== recipient || contact.provider_id !== doctor.provider_id || contact.snapshot_id !== options.snapshot) {
    throw new Error('The saved provider email has changed or is unavailable. Reopen Report / Send to review it.');
  }
  const pdf = await read({ ...options, format: 'ledger-pdf' });
  if (pdf.status !== 200 || !pdf.headers.get('content-type')?.includes('application/pdf')) throw new Error('The provider PDF could not be prepared. No email was sent.');
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('The provider PDF is invalid. No email was sent.');
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const filename = doctorReportFilename(doctor, period.payday);
  const { data, error } = await client.functions.invoke('send-payroll-report', { body: {
    recipient_email: recipient, recipient_name: doctor.provider_name, cc_emails: [], bcc_emails: [],
    subject: `Nu Dental Compensation Report — ${doctor.provider_name} — Payday ${period.payday}`,
    body_html: `<p>Hello ${escape(doctor.provider_name)},</p><p>Attached is your compensation estimate for payday ${escape(period.payday)}, including collections by office and the monthly tier calculation.</p><p>Please review the report and contact payroll with any questions.</p><p>Thank you,</p><p>Nu Dental Payroll</p>`,
    provider_name: doctor.provider_name, pay_period_start: period.pay_period_start, pay_period_end: period.pay_period_end,
    pdf_base64: encode(binary), pdf_filename: filename,
  } });
  if (error || data?.success !== true || !data?.message_id) {
    throw new Error('Email delivery was not confirmed. Check sent history before trying again.');
  }
  // A log failure must never turn a successful send into a retry prompt.
  let historySaved = false;
  try {
    const { data: auth } = await client.auth.getUser();
    const rates = [...new Set(doctor.months.map(m => m.applied_percent))];
    const saved = await client.from('payroll_report_sent_log').insert({
      provider_name: doctor.provider_name, provider_id: doctor.provider_id, provider_type: 'doctor',
      office_name: 'All qualifying offices', pay_period_start: period.pay_period_start, pay_period_end: period.pay_period_end,
      payday: period.payday, compensation_pct: rates.length === 1 ? rates[0] / 100 : (doctor.eligible_period_cents ? Number((doctor.estimate_cents / doctor.eligible_period_cents).toFixed(4)) : 0),
      total_collections: doctor.eligible_period_cents / 100, compensation_amount: doctor.estimate_cents / 100,
      recipient_email: recipient, cc_emails: [], sent_by: auth?.user?.id, sent_at: new Date().toISOString(),
      pdf_filename: filename, reconciliation_status: 'no_detail',
      notes: JSON.stringify({ source: 'Ascend saved calculation', snapshot: options.snapshot, calculation: doctor.calculation_id,
        message_id: data.message_id, percentage: rates.length === 1 ? 'applied rate' : 'effective blended rate for history only; see monthly rates in PDF',
        months: doctor.months.map(m => ({ month: m.month, percent: m.applied_percent, estimate_cents: m.estimate_cents })) }),
    });
    historySaved = !saved.error;
  } catch { /* Delivery already succeeded; retain its receipt in the dialog. */ }
  return { messageId: data.message_id, historySaved };
}
