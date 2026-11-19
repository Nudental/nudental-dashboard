import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import {
  createVerificationRequest,
  fetchOffices,
  insertAuditLog,
} from '../../../services/insuranceVerifyService';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';

// ─── Field Component ──────────────────────────────────────────────────────────

const Field = ({ label, required = false, children, hint = null }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-text-secondary">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-text-secondary italic">{hint}</p>}
  </div>
);

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';

// ─── New Verification Request Form ────────────────────────────────────────────

export default function NewVerificationRequestForm({ onSuccess }) {
  const { userProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [offices, setOffices] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const sharedLogin = offices.some(o => o.email?.toLowerCase() === userProfile?.email?.toLowerCase());
  const [form, setForm] = useState({
    officeId: '',
    officeName: '',
    officeEmail: '',
    patientFirstName: '',
    patientLastName: '',
    patientDob: '',
    ascendChartNumber: '',
    patientPhone: '',
    appointmentDate: '',
    appointmentTime: '',
    insuranceCompanyName: '',
    memberId: '',
    groupNumber: '',
    insurancePhone: '',
    requestingStaffName: userProfile?.full_name || '',
    requestingStaffRole: userProfile?.role || '',
    additionalNotes: '',
  });

  const [errors, setErrors] = useState({});

  const loadData = useCallback(async () => {
    try {
      const officeData = (await fetchOffices()).filter(o => o.can_submit);
      setOffices(officeData);
      if (officeData.length === 1) {
        const [office] = officeData;
        setForm(prev => ({ ...prev, requestingStaffName: office.email?.toLowerCase() === userProfile?.email?.toLowerCase() ? '' : prev.requestingStaffName, officeId: office.id, officeName: office.name, officeEmail: office.email }));
      }
    } catch (err) {
      setErrors(prev => ({ ...prev, officeId: 'Could not load your offices. Reopen New Request to retry.' }));
    }
  }, [userProfile?.email]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-fill office email when office is selected
  const handleOfficeChange = (officeId) => {
    const office = offices?.find((o) => o?.id === officeId);
    setForm((prev) => ({
      ...prev,
      officeId,
      officeName: office?.name || '',
      officeEmail: office?.email || '',
    }));
  };

  const set = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors?.[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form?.officeId) errs.officeId = 'Office is required';
    if (!form?.patientFirstName?.trim()) errs.patientFirstName = 'Required';
    if (!form?.patientLastName?.trim()) errs.patientLastName = 'Required';
    if (!form?.patientDob) errs.patientDob = 'Required';
    if (form.ascendChartNumber?.trim() && !/^[A-Z0-9-]{1,40}$/i.test(form.ascendChartNumber.trim())) errs.ascendChartNumber = 'Enter the chart number only, or leave blank if unknown';
    if (!form?.appointmentDate) errs.appointmentDate = 'Required';
    if (!form?.appointmentTime) errs.appointmentTime = 'Required';
    if (!form?.insuranceCompanyName?.trim()) errs.insuranceCompanyName = 'Required';
    if (!form?.memberId?.trim()) errs.memberId = 'Required';
    if (!form?.insurancePhone?.trim()) errs.insurancePhone = 'Required';
    return errs;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const errs = validate();
    if (Object.keys(errs)?.length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const newRequest = await createVerificationRequest(form, userProfile);

      // Attempt audit log — non-fatal
      await insertAuditLog({
        requestId: newRequest?.id,
        eventType: 'request_created',
        performedByUserId: userProfile?.id,
        performedByEmail: userProfile?.email,
        performedByName: userProfile?.full_name,
        newStatus: 'requested',
        metadata: {
          office_name: form?.officeName,
          patient_name: `${form?.patientFirstName} ${form?.patientLastName}`?.trim(),
        },
      });

      success('Request Submitted', 'Your request is in the verification queue.');
      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      toastError('Submission Failed', err?.message || 'Could not save the request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm({
      officeId: offices.length === 1 ? offices[0].id : '',
      officeName: offices.length === 1 ? offices[0].name : '',
      officeEmail: offices.length === 1 ? offices[0].email : '',
      patientFirstName: '',
      patientLastName: '',
      patientDob: '',
      ascendChartNumber: '',
      patientPhone: '',
      appointmentDate: '',
      appointmentTime: '',
      insuranceCompanyName: '',
      memberId: '',
      groupNumber: '',
      insurancePhone: '',
      requestingStaffName: sharedLogin ? '' : userProfile?.full_name || '',
      requestingStaffRole: userProfile?.role || '',
      additionalNotes: '',
    });
    setErrors({});
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <Icon name="CheckCircle" size={32} className="text-emerald-600" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-text-primary mb-1">Request Submitted</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            The verification request has been saved to Nu Dashboard with status <strong>Requested</strong>.
            Your office will be notified when the breakdown is complete.
          </p>
        </div>
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Phase 2A notice */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs">
        <Icon name="Info" size={15} className="mt-0.5 flex-shrink-0" />
        <span>
          Submit the request to the verification queue. The designated verifier receives the request. The office receives a link when the breakdown is complete.
        </span>
      </div>
      {/* Office */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Office" required>
          <select
            value={form?.officeId}
            onChange={(e) => handleOfficeChange(e?.target?.value)}
            className={`${inputCls} ${errors?.officeId ? 'border-red-400' : ''}`}
          >
            <option value="">— Select office —</option>
            {offices?.map((o) => (
              <option key={o?.id} value={o?.id}>{o?.name}</option>
            ))}
          </select>
          {errors?.officeId && <p className="text-xs text-red-500">{errors?.officeId}</p>}
        </Field>
        <Field label="Office completion email" hint="From the office directory">
          <input
            type="email"
            value={form?.officeEmail}
            readOnly
            placeholder="office@example.com"
            className={inputCls}
          />
        </Field>
      </div>
      {/* Patient */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Icon name="User" size={15} className="text-primary" />
          Patient Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="First Name" required>
            <input
              type="text"
              value={form?.patientFirstName}
              onChange={(e) => set('patientFirstName', e?.target?.value)}
              className={`${inputCls} ${errors?.patientFirstName ? 'border-red-400' : ''}`}
            />
            {errors?.patientFirstName && <p className="text-xs text-red-500">{errors?.patientFirstName}</p>}
          </Field>
          <Field label="Last Name" required>
            <input
              type="text"
              value={form?.patientLastName}
              onChange={(e) => set('patientLastName', e?.target?.value)}
              className={`${inputCls} ${errors?.patientLastName ? 'border-red-400' : ''}`}
            />
            {errors?.patientLastName && <p className="text-xs text-red-500">{errors?.patientLastName}</p>}
          </Field>
          <Field label="Date of Birth" required>
            <input
              type="date"
              value={form?.patientDob}
              onChange={(e) => set('patientDob', e?.target?.value)}
              className={`${inputCls} ${errors?.patientDob ? 'border-red-400' : ''}`}
            />
            {errors?.patientDob && <p className="text-xs text-red-500">{errors?.patientDob}</p>}
          </Field>
          <Field label="Ascend chart number (optional)" hint="Copy it from the correct Ascend chart. Leave blank if unknown; name, DOB and office must still match.">
            <input type="text" aria-label="Ascend chart number" maxLength={40} value={form.ascendChartNumber}
              onChange={e => set('ascendChartNumber', e.target.value)} className={inputCls} />
            {errors.ascendChartNumber && <p role="alert" className="text-xs text-red-500">{errors.ascendChartNumber}</p>}
          </Field>
          <Field label="Patient Phone">
            <input
              type="tel"
              value={form?.patientPhone}
              onChange={(e) => set('patientPhone', e?.target?.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </div>
      {/* Appointment */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Icon name="Calendar" size={15} className="text-primary" />
          Appointment
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Appointment Date" required>
            <input
              type="date"
              value={form?.appointmentDate}
              onChange={(e) => set('appointmentDate', e?.target?.value)}
              className={`${inputCls} ${errors?.appointmentDate ? 'border-red-400' : ''}`}
            />
            {errors?.appointmentDate && <p className="text-xs text-red-500">{errors?.appointmentDate}</p>}
          </Field>
          <Field label="Appointment Time" required>
            <input
              type="time"
              value={form?.appointmentTime}
              onChange={(e) => set('appointmentTime', e?.target?.value)}
              className={`${inputCls} ${errors?.appointmentTime ? 'border-red-400' : ''}`}
            />
            {errors?.appointmentTime && <p className="text-xs text-red-500">{errors?.appointmentTime}</p>}
          </Field>
        </div>
      </div>
      {/* Insurance */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Icon name="FileText" size={15} className="text-primary" />
          Insurance Information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Insurance Company" required>
            <input
              type="text"
              value={form?.insuranceCompanyName}
              onChange={(e) => set('insuranceCompanyName', e?.target?.value)}
              className={`${inputCls} ${errors?.insuranceCompanyName ? 'border-red-400' : ''}`}
            />
            {errors?.insuranceCompanyName && <p className="text-xs text-red-500">{errors?.insuranceCompanyName}</p>}
          </Field>
          <Field label="Member ID" required>
            <input
              type="text"
              value={form?.memberId}
              onChange={(e) => set('memberId', e?.target?.value)}
              className={`${inputCls} ${errors?.memberId ? 'border-red-400' : ''}`}
            />
            {errors?.memberId && <p className="text-xs text-red-500">{errors?.memberId}</p>}
          </Field>
          <Field label="Group Number">
            <input
              type="text"
              value={form?.groupNumber}
              onChange={(e) => set('groupNumber', e?.target?.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Insurance Phone" required>
            <input
              type="tel"
              value={form?.insurancePhone}
              onChange={(e) => set('insurancePhone', e?.target?.value)}
              className={`${inputCls} ${errors?.insurancePhone ? 'border-red-400' : ''}`}
            />
            {errors?.insurancePhone && <p className="text-xs text-red-500">{errors?.insurancePhone}</p>}
          </Field>
        </div>
      </div>
      {/* Requester & Assignment */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Icon name="UserCheck" size={15} className="text-primary" />
          Requesting staff
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Requesting Staff Name" required>
            <input
              type="text"
              required
              readOnly={!sharedLogin}
              placeholder="Your full name"
              value={form?.requestingStaffName}
              onChange={(e) => set('requestingStaffName', e?.target?.value)}
              className={inputCls}
            />
          </Field>

        </div>
      </div>
      {/* Notes */}
      <Field label="Notes">
        <textarea
          value={form?.additionalNotes}
          onChange={(e) => set('additionalNotes', e?.target?.value)}
          rows={3}
          placeholder="Any additional information for the verifier…"
          className={`${inputCls} resize-none`}
        />
      </Field>
      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {submitting && <Icon name="Loader2" size={15} className="animate-spin" />}
          {submitting ? 'Saving…' : 'Submit Request'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={submitting}
          className="px-4 py-2.5 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-60"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
