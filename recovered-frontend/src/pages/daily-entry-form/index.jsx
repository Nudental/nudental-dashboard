import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useHomeNavigation from '../../hooks/useHomeNavigation';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import EntryDatePicker from './components/EntryDatePicker';
import RevenueSection from './components/RevenueSection';
import ExpenseSection from './components/ExpenseSection';
import NotesField from './components/NotesField';
import SubmissionConfirmation from './components/SubmissionConfirmation';
import DailyOperationsSection from './components/DailyOperationsSection';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOffice } from '../../contexts/OfficeContext';
import DailyBulkImportTab from './components/DailyBulkImportTab';
import { useRbacGuard, AccessDenied } from '../../hooks/useRbacGuard';

import DentrixDailyCloseoutTab from './components/DentrixDailyCloseoutTab';
import UnscheduledTreatmentTab from './components/UnscheduledTreatmentTab';
import TreatmentPlanCompletionTab from './components/TreatmentPlanCompletionTab';

// ─── Approval notification helper ─────────────────────────────────────────
const sendApprovalNotification = async ({ submitterName, officeName, date, entryId }) => {
  try {
    const { data: { session } } = await supabase?.auth?.getSession();
    const token = session?.access_token;
    const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
    await fetch(`${supabaseUrl}/functions/v1/approval-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        type: 'daily_entry',
        submitter_name: submitterName,
        office_name: officeName,
        date,
        entry_id: entryId,
      }),
    });
  } catch (err) {
    console.error('[approval-notification] daily_entry email failed:', err?.message);
  }
};


const AUTO_SAVE_INTERVAL = 30000;

const getTodayStr = () => new Date()?.toISOString()?.split('T')?.[0];

const generateTrackingNumber = () => {
  const ts = Date.now()?.toString(36)?.toUpperCase();
  const rand = Math.random()?.toString(36)?.substring(2, 6)?.toUpperCase();
  return `NUD-${ts}-${rand}`;
};

const INITIAL_FORM = {
  entryDate: getTodayStr(),
  officeId: '',
  providerType: '',
  providerId: '',
  providerName: '',
  production: '',
  collection: '',
  serviceCategory: '',
  serviceCategoryId: '',
  expenseCategory: '',
  expenseCategoryId: '',
  expenseAmount: '',
  notes: '',
  newPatients: '',
  noShows: '',
  treatmentPresented: '',
  treatmentAccepted: '',
};

// Attestation checklist items
const ATTESTATION_ITEMS = [
  { id: 'attest_closeout',    label: 'Reviewed Dentrix Closeout' },
  { id: 'attest_deposit',     label: 'Reviewed deposit slip / collections' },
  { id: 'attest_voids',       label: 'Reviewed voided transactions' },
  { id: 'attest_appts',       label: 'Reviewed appointment counts' },
  { id: 'attest_unscheduled', label: 'Reviewed unscheduled treatment queue' },
  { id: 'attest_tp',          label: 'Reviewed treatment plan completion / open treatment' },
  { id: 'attest_exceptions',  label: 'Noted exceptions below' },
];

const STEPS = [
  { id: 1, label: 'Attestation', icon: 'CheckSquare', description: 'Daily review checklist' },
  { id: 2, label: 'Notes', icon: 'FileText', description: 'Exceptions & notes' },
  { id: 3, label: 'Legacy', icon: 'Archive', description: 'Optional reference fields' },
];

// Step Progress Indicator
const StepIndicator = ({ currentStep, steps, onStepClick }) => (
  <div className="flex items-center justify-between mb-6 px-1">
    {steps?.map((step, idx) => {
      const isCompleted = currentStep > step?.id;
      const isActive = currentStep === step?.id;
      return (
        <React.Fragment key={step?.id}>
          <button
            type="button"
            onClick={() => onStepClick(step?.id)}
            className="flex flex-col items-center gap-1.5 group"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
              isCompleted
                ? 'bg-success border-success text-white'
                : isActive
                ? 'bg-primary border-primary text-white shadow-lg scale-110'
                : 'bg-card border-border text-muted-foreground group-hover:border-primary/50'
            }`}>
              {isCompleted ? (
                <Icon name="Check" size={16} />
              ) : (
                <Icon name={step?.icon} size={16} />
              )}
            </div>
            <div className="text-center hidden sm:block">
              <p className={`text-xs font-semibold ${
                isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'
              }`}>{step?.label}</p>
              <p className="text-[10px] text-muted-foreground">{step?.description}</p>
            </div>
            <p className={`text-[10px] font-medium sm:hidden ${
              isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'
            }`}>{step?.label}</p>
          </button>
          {idx < steps?.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${
              currentStep > step?.id ? 'bg-success' : 'bg-border'
            }`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// Collapsible Accordion wrapper
const AccordionSection = ({ title, icon, iconColor, isOpen, onToggle, children, badge = null }) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-smooth"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${iconColor}18` }}>
          <Icon name={icon} size={16} color={iconColor} />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {badge && <p className="text-xs text-muted-foreground">{badge}</p>}
        </div>
      </div>
      <Icon
        name={isOpen ? 'ChevronUp' : 'ChevronDown'}
        size={18}
        color="var(--color-muted-foreground)"
      />
    </button>
    {isOpen && (
      <div className="px-5 pb-5 pt-1 border-t border-border/50">
        {children}
      </div>
    )}
  </div>
);

const DailyEntryForm = () => {
  const { userProfile, user } = useAuth();
  const { selectedOfficeId, canSwitchOffice, offices } = useOffice();
  const navigate = useNavigate();
  const goHome = useHomeNavigation();
  const { canAccess, loading: rbacLoading } = useRbacGuard();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [activeTab, setActiveTab] = useState('dentrix'); // 'dentrix' | 'unscheduled' | 'tp_completion' | 'single' | 'bulk' | 'approvals'
  const autoSaveRef = useRef(null);
  const lastSavedRef = useRef(null);
  const [attestation, setAttestation] = useState({});
  const [legacyFinancialOpen, setLegacyFinancialOpen] = useState(false);
  const [legacyOperationsOpen, setLegacyOperationsOpen] = useState(false);

  // Role-based access: Admin and Super Admin only (matching Morning Huddle)
  const isAdmin = ['super_admin', 'admin']?.includes(userProfile?.role);
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const canViewApprovals = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager']?.includes(userProfile?.role);

  // ─── RBAC page guard ──────────────────────────────────────────────────────
  if (rbacLoading) return null;
  if (!canAccess('workflow.eod.view')) {
    return <AccessDenied title="EOD Report" message="You don't have permission to access EOD Report. Contact your administrator." />;
  }

  const breadcrumbItems = [
    { label: 'Home', path: '/executive-overview' },
    { label: 'Operations', path: null },
    { label: 'EOD Report', path: '/daily-entry-form' },
  ];

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const performAutoSave = useCallback(() => {
    if (isLocked) return;
    const serialized = JSON.stringify(form);
    if (serialized === lastSavedRef?.current) return;
    setSaveStatus('saving');
    setTimeout(() => {
      try {
        localStorage.setItem('daily_entry_draft', serialized);
        lastSavedRef.current = serialized;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch {
        setSaveStatus('idle');
      }
    }, 500);
  }, [form, isLocked]);

  useEffect(() => {
    try {
      const draft = localStorage.getItem('daily_entry_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        setForm(prev => ({ ...prev, ...parsed, entryDate: parsed?.entryDate || getTodayStr() }));
      }
    } catch {}
  }, []);

  // Load active offices
  useEffect(() => {
    const fetchOffices = async () => {
      setLoadingOffices(true);
      try {
        const { data, error } = await supabase
          ?.from('offices')
          ?.select('id, name')
          ?.eq('is_active', true)
          ?.order('name', { ascending: true });
        if (!error && data) {
          // Default to user's assigned office if not already set
          setForm(prev => ({
            ...prev,
            officeId: prev?.officeId || userProfile?.office_id || (data?.length === 1 ? data?.[0]?.id : ''),
          }));
        }
      } catch (err) {
        console.warn('Failed to load offices:', err?.message);
      } finally {
        setLoadingOffices(false);
      }
    };
    fetchOffices();
  }, [userProfile?.office_id]);

  useEffect(() => {
    autoSaveRef.current = setInterval(performAutoSave, AUTO_SAVE_INTERVAL);
    return () => clearInterval(autoSaveRef?.current);
  }, [performAutoSave]);

  // Fallback: if non-super_admin somehow lands on 'bulk', redirect to 'dentrix'
  useEffect(() => {
    if (activeTab === 'bulk' && !isSuperAdmin) {
      setActiveTab('dentrix');
    }
  }, [activeTab, isSuperAdmin]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors?.[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form?.entryDate) newErrors.entryDate = 'Entry date is required';
    if (!form?.officeId && !userProfile?.office_id) newErrors.officeId = 'Practice location is required';
    // Notes or at least one attestation checkbox required
    const hasNotes = form?.notes && form?.notes?.trim()?.length > 0;
    const hasAttestation = Object.values(attestation)?.some(Boolean);
    if (!hasNotes && !hasAttestation) {
      newErrors.notes = 'Please enter daily notes/exceptions or check at least one attestation item';
    }
    // Legacy financial fields are optional — only validate if provided
    if (form?.production !== '' && form?.production !== null && form?.production !== undefined && parseFloat(form?.production) < 0)
      newErrors.production = 'Production amount must be 0 or greater if provided';
    if (form?.collection !== '' && form?.collection !== null && form?.collection !== undefined && parseFloat(form?.collection) < 0)
      newErrors.collection = 'Collection amount must be 0 or greater if provided';
    if (form?.treatmentAccepted && form?.treatmentPresented &&
        parseFloat(form?.treatmentAccepted) > parseFloat(form?.treatmentPresented)) {
      newErrors.treatmentAccepted = 'Treatment accepted cannot exceed treatment presented';
    }
    return newErrors;
  };

  const validateStep = (step) => {
    const newErrors = {};
    if (step === 1) {
      // Attestation step — no hard required fields, just date/office
      if (!form?.entryDate) newErrors.entryDate = 'Entry date is required';
    }
    if (step === 2) {
      // Notes step — require notes or attestation
      const hasNotes = form?.notes && form?.notes?.trim()?.length > 0;
      const hasAttestation = Object.values(attestation)?.some(Boolean);
      if (!hasNotes && !hasAttestation) {
        newErrors.notes = 'Please enter daily notes/exceptions or check at least one attestation item';
      }
    }
    return newErrors;
  };

  // Build attestation summary to append to notes on submit
  const buildAttestationSummary = () => {
    const checked = ATTESTATION_ITEMS?.filter(item => attestation?.[item?.id]);
    if (checked?.length === 0) return '';
    const lines = checked?.map(item => `✓ ${item?.label}`);
    return `\n\n--- Daily Review Attestation ---\n${lines?.join('\n')}`;
  };

  const handleNextStep = () => {
    const stepErrors = validateStep(currentStep);
    if (Object.keys(stepErrors)?.length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setCurrentStep(prev => Math.min(prev + 1, STEPS?.length));
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors)?.length > 0) {
      setErrors(validationErrors);
      if (validationErrors?.notes) setCurrentStep(2);
      else if (validationErrors?.production || validationErrors?.collection) setCurrentStep(3);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const tracking = generateTrackingNumber();
      const hasExpense = (form?.expenseCategory && form?.expenseCategory !== '') ||
        (form?.expenseAmount !== '' && form?.expenseAmount !== null && form?.expenseAmount !== undefined && parseFloat(form?.expenseAmount) >= 0);
      const hasProduction = form?.production !== '' && form?.production !== null && form?.production !== undefined;
      const hasCollection = form?.collection !== '' && form?.collection !== null && form?.collection !== undefined;

      // Append attestation summary to notes
      const attestationSummary = buildAttestationSummary();
      const notesWithAttestation = (form?.notes || '') + attestationSummary;

      const payload = {
        office_id: form?.officeId || userProfile?.office_id || null,
        entry_date: form?.entryDate,
        provider_type: form?.providerType || null,
        provider_id: form?.providerId || null,
        provider_name: form?.providerName || null,
        production: hasProduction ? parseFloat(form?.production) : null,
        collection: hasCollection ? parseFloat(form?.collection) : null,
        service_category: form?.serviceCategory || null,
        expense_category: hasExpense ? (form?.expenseCategory || null) : null,
        expense_amount: hasExpense ? (parseFloat(form?.expenseAmount) >= 0 ? parseFloat(form?.expenseAmount) : 0) : null,
        new_patients: form?.newPatients !== '' && form?.newPatients !== null && form?.newPatients !== undefined ? parseInt(form?.newPatients) : null,
        no_shows: form?.noShows !== '' && form?.noShows !== null && form?.noShows !== undefined ? parseInt(form?.noShows) : null,
        treatment_presented: form?.treatmentPresented !== '' && form?.treatmentPresented !== null && form?.treatmentPresented !== undefined ? parseFloat(form?.treatmentPresented) : null,
        treatment_accepted: form?.treatmentAccepted !== '' && form?.treatmentAccepted !== null && form?.treatmentAccepted !== undefined ? parseFloat(form?.treatmentAccepted) : null,
        notes: notesWithAttestation || '',
        status: 'pending',
        submitted_by: user?.id || null,
        submitted_at: new Date()?.toISOString(),
        submitter_name: userProfile?.full_name || userProfile?.email || null,
      };

      const { data: insertedEntry, error: dbError } = await supabase?.from('daily_entries')?.insert(payload)?.select()?.single();
      if (dbError) throw new Error(dbError?.message || 'Failed to save entry to database');

      // Send approval notification email (non-blocking)
      const officeName = offices?.find(o => o?.id === (form?.officeId || userProfile?.office_id))?.name || '';
      sendApprovalNotification({
        submitterName: userProfile?.full_name || userProfile?.email || 'Staff',
        officeName,
        date: form?.entryDate,
        entryId: insertedEntry?.id,
      });

      setTrackingNumber(tracking);
      setIsLocked(true);
      setIsSubmitted(true);
      localStorage.removeItem('daily_entry_draft');
      clearInterval(autoSaveRef?.current);
    } catch (err) {
      console.error('Submission error:', err);
      setSubmitError(err?.message || 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewEntry = () => {
    const retained = { providerType: form?.providerType, providerId: form?.providerId, providerName: form?.providerName, expenseCategory: form?.expenseCategory };
    setForm({ ...INITIAL_FORM, ...retained });
    setErrors({});
    setIsSubmitted(false);
    setIsLocked(false);
    setTrackingNumber('');
    setSaveStatus('idle');
    setSubmitError('');
    setCurrentStep(1);
    lastSavedRef.current = null;
    autoSaveRef.current = setInterval(performAutoSave, AUTO_SAVE_INTERVAL);
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const expenseBadge = form?.expenseCategory && (form?.expenseAmount !== '' && form?.expenseAmount !== null && form?.expenseAmount !== undefined && parseFloat(form?.expenseAmount) >= 0)
    ? `${form?.expenseCategory} — $${parseFloat(form?.expenseAmount)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : form?.expenseCategory ? form?.expenseCategory : 'Not filled';

  const operationsBadge = form?.newPatients || form?.noShows
    ? `${form?.newPatients || 0} new patients, ${form?.noShows || 0} no-shows`
    : 'Optional';

  return (
    <div className="min-h-screen bg-background">
      {/* Global Header — matches Financial Analytics & Morning Huddle */}
      <Breadcrumb items={breadcrumbItems} />

      <main className="main-content">
        <div className="w-full px-4 lg:px-6 xl:px-8 py-6 md:py-8">
          {/* Page Header */}
          <div className="mb-6">
            {/* Back to Home — matches Morning Huddle pattern */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={goHome}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-smooth"
                  aria-label="Back to Home"
                >
                  <Icon name="ChevronLeft" size={18} />
                  <span className="hidden sm:inline">Back to Home</span>
                </button>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon name="ClipboardList" size={20} color="var(--color-primary)" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">EOD Report</h1>
                  <p className="text-xs text-muted-foreground">NU Dental Practice Management</p>
                </div>
              </div>
              {/* Auto-save status + role badge */}
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                    <Icon name="ShieldCheck" size={12} />
                    {userProfile?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                )}
                {activeTab === 'single' && !isSubmitted && (
                  <div className="flex items-center gap-2 text-xs">
                    {saveStatus === 'saving' && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Icon name="Loader" size={13} className="animate-spin" />Saving...
                      </span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="flex items-center gap-1.5 text-success">
                        <Icon name="CheckCircle" size={13} />Saved
                      </span>
                    )}
                    {saveStatus === 'idle' && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Icon name="Cloud" size={13} />Auto-save
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isLocked && !isSubmitted && activeTab === 'single' && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg">
                <Icon name="Lock" size={16} color="var(--color-warning)" />
                <span className="text-sm text-warning font-medium">This entry is locked and pending review</span>
              </div>
            )}
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-xl p-1 mb-5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('dentrix')}
              className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-smooth ${
                activeTab === 'dentrix' ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="Database" size={15} />
              Dentrix Closeout
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unscheduled')}
              className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-smooth ${
                activeTab === 'unscheduled' ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="Users" size={15} />
              Unscheduled Treatment
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tp_completion')}
              className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-smooth ${
                activeTab === 'tp_completion' ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="CheckSquare" size={15} />
              Treatment Plan Completion
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-smooth ${
                activeTab === 'single' ?'bg-card text-foreground shadow-elevation-1' :'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="ClipboardList" size={15} />
              Office Daily Review / Attestation
            </button>
            {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('bulk')}
              className={`flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-smooth ${
                activeTab === 'bulk' ?'bg-card text-foreground shadow-elevation-1' :'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="Upload" size={15} />
              Legacy Import
            </button>
            )}
            {/* Approvals tab button removed (V552) — approvals moved to Workflow Approvals Queue */}
          </div>

          {/* Dentrix Daily Closeout Tab */}
          {activeTab === 'dentrix' && (
            <div className="space-y-4">
              <DentrixDailyCloseoutTab
                propOfficeId={form?.officeId || selectedOfficeId || ''}
                propDate={form?.entryDate || ''}
              />
            </div>
          )}

          {/* Unscheduled Treatment Tab */}
          {activeTab === 'unscheduled' && (
            <div className="space-y-4">
              <UnscheduledTreatmentTab
                propOfficeId={form?.officeId || selectedOfficeId || ''}
                propDate={form?.entryDate || ''}
              />
            </div>
          )}

          {/* Treatment Plan Completion Tab */}
          {activeTab === 'tp_completion' && (
            <div className="space-y-4">
              <TreatmentPlanCompletionTab
                propOfficeId={form?.officeId || selectedOfficeId || ''}
                propDate={form?.entryDate || ''}
              />
            </div>
          )}

          {/* Bulk Import Tab */}
          {activeTab === 'bulk' && isSuperAdmin && (
            <div className="bg-card border border-border rounded-xl p-5">
              <DailyBulkImportTab
                propOfficeId={form?.officeId || selectedOfficeId || ''}
                selectedDate={form?.entryDate || getTodayStr()}
                propOffices={offices || []}
              />
            </div>
          )}

          {/* Approvals — demoted: redirect info panel (V552) */}
          {activeTab === 'approvals' && canViewApprovals && (
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-start gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <Icon name="ClipboardCheck" size={20} color="#2563EB" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Approvals Have Moved</p>
                  <p className="text-xs text-muted-foreground">Workflow → Approvals Queue</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Daily Review and Morning Huddle approvals are now managed in{' '}
                <span className="font-semibold text-foreground">Workflow → Approvals Queue</span>.
                Use the unified queue for review, approval, rejection, and audit workflow.
              </p>
              <button
                type="button"
                onClick={() => navigate('/huddle-approvals')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-smooth"
              >
                <Icon name="ExternalLink" size={15} />
                Open Workflow Approvals Queue
              </button>
            </div>
          )}

          {/* Single Entry Tab */}
          {activeTab === 'single' && (
            <>
              {/* Informational banner — blue/teal, not amber warning */}
              <div className="flex items-start gap-3 px-4 py-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 rounded-xl mb-4">
                <Icon name="ClipboardCheck" size={16} color="#2563EB" className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Office Daily Review / Attestation</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    Use this section to confirm the daily Dentrix Closeout review and document office notes, exceptions, or follow-up items.
                    This workflow does not override Dentrix/FastAPI actuals and does not update official monthly analytics.
                    Official production, collections, appointments, deposit slip, and voided transactions remain in the{' '}
                    <button type="button" onClick={() => setActiveTab('dentrix')} className="underline font-semibold hover:text-blue-900 dark:hover:text-blue-100 transition-colors">Dentrix Closeout</button> tab.
                  </p>
                </div>
              </div>

              {/* Submitted Confirmation */}
              {isSubmitted ? (
                <div className="bg-card border border-border rounded-xl">
                  <SubmissionConfirmation
                    trackingNumber={trackingNumber}
                    entryDate={formatDateDisplay(form?.entryDate)}
                    onNewEntry={handleNewEntry}
                  />
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  {/* A. Office / Date */}
                  <div className="bg-card border border-border rounded-xl p-5 mb-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon name="MapPin" size={14} color="var(--color-primary)" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">Office / Date</h3>
                    </div>
                    {/* Practice Location */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Practice Location <span className="text-destructive">*</span>
                      </label>
                      {loadingOffices ? (
                        <div className="flex items-center gap-2 py-3 px-4 border border-border rounded-lg bg-background">
                          <Icon name="Loader" size={14} className="animate-spin" color="var(--color-muted-foreground)" />
                          <span className="text-sm text-muted-foreground">Loading offices...</span>
                        </div>
                      ) : (
                        <select
                          value={form?.officeId || ''}
                          onChange={(e) => handleChange('officeId', e?.target?.value)}
                          disabled={isLocked || (!canSwitchOffice && !!selectedOfficeId)}
                          className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
                        >
                          <option value="">Select office location...</option>
                          {offices?.map((office) => (
                            <option key={office?.id} value={office?.id}>
                              {office?.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {!canSwitchOffice && selectedOfficeId && (
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Icon name="Lock" size={11} />
                          Restricted to your assigned office
                        </p>
                      )}
                      {errors?.officeId && (
                        <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                          <Icon name="AlertCircle" size={12} />{errors?.officeId}
                        </p>
                      )}
                    </div>
                    <EntryDatePicker
                      value={form?.entryDate}
                      onChange={(val) => handleChange('entryDate', val)}
                      disabled={isLocked}
                    />
                    {errors?.entryDate && (
                      <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                        <Icon name="AlertCircle" size={12} />{errors?.entryDate}
                      </p>
                    )}
                  </div>

                  {/* B. Daily Review Attestation */}
                  <div className="bg-card border border-border rounded-xl p-5 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                        <Icon name="CheckSquare" size={14} color="var(--color-success)" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Daily Review Attestation</h3>
                        <p className="text-xs text-muted-foreground">Workflow attestation only — check all items reviewed today</p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {ATTESTATION_ITEMS?.map(item => (
                        <label
                          key={item?.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-smooth ${
                            attestation?.[item?.id]
                              ? 'bg-success/5 border-success/30 text-foreground'
                              : 'bg-background border-border hover:border-primary/30 text-muted-foreground'
                          } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={!!attestation?.[item?.id]}
                            onChange={e => setAttestation(prev => ({ ...prev, [item?.id]: e?.target?.checked }))}
                            disabled={isLocked}
                            className="w-4 h-4 rounded border-border text-success focus:ring-success focus:ring-offset-0"
                          />
                          <span className="text-sm font-medium">{item?.label}</span>
                          {attestation?.[item?.id] && (
                            <Icon name="Check" size={13} color="var(--color-success)" className="ml-auto flex-shrink-0" />
                          )}
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Icon name="Info" size={10} />
                      Checked items will be appended to the notes on submit.
                    </p>
                  </div>

                  {/* C. Daily Notes / Exceptions — prominent, moved up */}
                  <div className="mb-4">
                    <NotesField
                      value={form?.notes}
                      onChange={handleChange}
                      disabled={isLocked}
                    />
                    {errors?.notes && (
                      <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                        <Icon name="AlertCircle" size={12} />{errors?.notes}
                      </p>
                    )}
                  </div>

                  {/* D. Legacy Manual Financial Reference — collapsed by default */}
                  <div className="mb-4">
                    <AccordionSection
                      title="Legacy Manual Financial Reference — Optional"
                      icon="Archive"
                      iconColor="var(--color-warning)"
                      isOpen={legacyFinancialOpen}
                      onToggle={() => setLegacyFinancialOpen(!legacyFinancialOpen)}
                      badge="Optional manual reference fields only — not Dentrix actuals"
                    >
                      <div className="pt-3">
                        <RevenueSection
                          data={form}
                          onChange={handleChange}
                          errors={errors}
                          disabled={isLocked}
                        />
                      </div>
                    </AccordionSection>
                  </div>

                  {/* Optional Expense Note — collapsed by default */}
                  <div className="mb-4">
                    <AccordionSection
                      title="Optional Manual Expense Note"
                      icon="TrendingDown"
                      iconColor="var(--color-destructive)"
                      isOpen={expenseOpen}
                      onToggle={() => setExpenseOpen(!expenseOpen)}
                      badge={expenseBadge !== 'Not filled' ? expenseBadge : 'Workflow reference only — not official accounting'}
                    >
                      <div className="pt-3">
                        <ExpenseSection
                          data={form}
                          onChange={handleChange}
                          errors={errors}
                          disabled={isLocked}
                          compact
                        />
                      </div>
                    </AccordionSection>
                  </div>

                  {/* Optional Operational Notes / Legacy Counts — collapsed by default */}
                  <div className="mb-4">
                    <AccordionSection
                      title="Optional Operational Notes / Legacy Counts"
                      icon="Activity"
                      iconColor="var(--color-primary)"
                      isOpen={operationsOpen}
                      onToggle={() => setOperationsOpen(!operationsOpen)}
                      badge={operationsBadge !== 'Optional' ? operationsBadge : 'Manual reference counts — not Dentrix actuals'}
                    >
                      <div className="pt-3">
                        <DailyOperationsSection
                          data={form}
                          onChange={handleChange}
                          errors={errors}
                          disabled={isLocked}
                          compact
                        />
                      </div>
                    </AccordionSection>
                  </div>

                  {/* Desktop Submit */}
                  <div className="hidden md:block bg-card border border-border rounded-xl p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">Submit daily workflow notes / attestation for review.</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Submitting will send this office review/attestation to the approval workflow. Legacy financial fields are optional.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={performAutoSave}
                          disabled={isLocked || saveStatus === 'saving'}
                          className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-smooth"
                        >
                          {saveStatus === 'saving' ? (
                            <><Icon name="Loader" size={15} className="animate-spin" />Saving...</>
                          ) : (
                            <><Icon name="Save" size={15} />Save Draft</>
                          )}
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || isLocked}
                          className="flex items-center gap-2.5 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-smooth focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 whitespace-nowrap"
                        >
                          {isSubmitting ? (
                            <><Icon name="Loader" size={16} className="animate-spin" />Submitting...</>
                          ) : (
                            <><Icon name="Send" size={16} />Submit Attestation for Review</>
                          )}
                        </button>
                      </div>
                    </div>

                    {submitError && (
                      <div className="mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <p className="text-xs text-destructive flex items-center gap-1.5">
                          <Icon name="AlertCircle" size={13} />{submitError}
                        </p>
                      </div>
                    )}

                    {Object.keys(errors)?.length > 0 && (
                      <div className="mt-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name="AlertTriangle" size={14} color="var(--color-destructive)" />
                          <span className="text-xs font-semibold text-destructive">Please fix the following errors:</span>
                        </div>
                        <ul className="space-y-1">
                          {Object.values(errors)?.filter(Boolean)?.map((err, i) => (
                            <li key={i} className="text-xs text-destructive flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-destructive flex-shrink-0" />
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Mobile Submit */}
                  <div className="md:hidden flex gap-3 mt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || isLocked}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
                    >
                      {isSubmitting ? (
                        <><Icon name="Loader" size={16} className="animate-spin" />Submitting...</>
                      ) : (
                        <><Icon name="Send" size={16} />Submit Attestation for Review</>
                      )}
                    </button>
                  </div>

                  {/* Mobile submit error */}
                  {submitError && (
                    <div className="md:hidden mt-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                      <p className="text-xs text-destructive flex items-center gap-1.5">
                        <Icon name="AlertCircle" size={13} />{submitError}
                      </p>
                    </div>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default DailyEntryForm;
