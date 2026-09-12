import React, { useRef, useState, useCallback } from 'react';
import Icon from '../../components/AppIcon';
import { useRbacGuard, AccessDenied } from '../../hooks/useRbacGuard';
import useRolePermissions from '../../hooks/useRolePermissions';
import RequestQueue from './components/RequestQueue';
import NewVerificationRequestForm from './components/NewVerificationRequestForm';
import RequestDetailDrawer from './components/RequestDetailDrawer';
import InsuranceVerificationForm from './components/InsuranceVerificationForm';

// ─── Legacy iframe URL ────────────────────────────────────────────────────────
const LEGACY_IFRAME_URL = 'https://insurance-verification-request-mxb2g01.public.builtwithrocket.new';

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'queue',   label: 'Request Queue',  icon: 'List' },
  { id: 'new',     label: 'New Request',    icon: 'PlusCircle' },
  { id: 'legacy',  label: 'Legacy Form',    icon: 'ExternalLink' },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InsuranceVerify() {
  const { canAccess, loading: rbacLoading } = useRbacGuard();
  const { hasPermission } = useRolePermissions();

  const [activeTab, setActiveTab] = useState('queue');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [queueKey, setQueueKey] = useState(0);

  // Phase 3A: verification form view
  // { request, verification } — when set, show the form instead of tabs
  const [verifView, setVerifView] = useState(null);

  const iframeRef = useRef(null);

  // Permission checks
  const canView     = canAccess('workflow.insurance.view');
  const canSubmit   = hasPermission('workflow.insurance.submit');
  const canCancel   = hasPermission('workflow.insurance.cancel');
  const canComplete = hasPermission('workflow.insurance.complete');

  const handleNewRequestSuccess = useCallback(() => {
    setQueueKey((k) => k + 1);
    setActiveTab('queue');
  }, []);

  const handleQueueRefresh = useCallback(() => {
    setQueueKey((k) => k + 1);
  }, []);

  // Called from RequestDetailDrawer to open the verification form
  const handleStartVerification = useCallback((request, verification) => {
    setVerifView({ request, verification });
    setSelectedRequest(null);
  }, []);

  // Called when the form saves (draft or complete)
  const handleVerifSaved = useCallback(() => {
    setQueueKey((k) => k + 1);
  }, []);

  // Back from verification form to queue
  const handleVerifBack = useCallback(() => {
    setVerifView(null);
    setQueueKey((k) => k + 1);
  }, []);

  if (rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Icon name="Loader2" size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!canView) {
    return <AccessDenied message="You don't have permission to access Insurance Verification. Contact your administrator." />;
  }

  // ── Phase 3A: Show verification form fullscreen ──
  if (verifView) {
    return (
      <div className="min-h-screen bg-background">
        <div className="main-content p-6">
          <InsuranceVerificationForm
            request={verifView?.request}
            onBack={handleVerifBack}
            onSaved={handleVerifSaved}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="main-content p-6 space-y-5">

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Insurance Verification</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Workflow → Insurance Verify
            </p>
          </div>
        </div>

        {/* Phase 4A Status Banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800">
          <Icon name="Info" size={18} className="mt-0.5 flex-shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-semibold">Native insurance verification workflow — Phase 4A</p>
            <p className="text-blue-700">
              Requests are saved in Nu Dashboard. Click a request row to open the detail drawer, then use
              <strong> Start Verification</strong> / <strong>Continue Verification</strong> / <strong>View Completed Verification</strong> to open the online breakdown form.
              Completed verifications can be <strong>downloaded as PDF</strong> from the form view or the detail drawer.
              No emails are sent. No Dentrix upload.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-border">
          {TABS?.map((tab) => {
            if (tab?.id === 'new' && !canSubmit) return null;
            return (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab?.id
                    ? 'border-primary text-primary bg-primary/5' :'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                }`}
              >
                <Icon name={tab?.icon} size={15} />
                {tab?.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {/* Request Queue */}
          {activeTab === 'queue' && (
            <RequestQueue
              key={queueKey}
              onSelectRequest={setSelectedRequest}
            />
          )}

          {/* New Request Form */}
          {activeTab === 'new' && canSubmit && (
            <NewVerificationRequestForm onSuccess={handleNewRequestSuccess} />
          )}

          {/* New Request — no permission */}
          {activeTab === 'new' && !canSubmit && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-secondary">
              <Icon name="ShieldOff" size={32} className="opacity-30" />
              <p className="text-sm">You don't have permission to submit verification requests.</p>
            </div>
          )}

          {/* Legacy Form */}
          {activeTab === 'legacy' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <Icon name="AlertTriangle" size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Legacy request form</p>
                  <p className="text-amber-700 text-xs mt-0.5">
                    The legacy form is currently unavailable. Use the native request screens below.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActiveTab('queue')} className="px-4 py-2 rounded-lg border border-border text-sm">Open Request Queue</button>
                {canSubmit && (
                  <button onClick={() => setActiveTab('new')} className="px-4 py-2 rounded-lg border border-border text-sm">Open New Request</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Request Detail Drawer */}
      {selectedRequest && (
        <RequestDetailDrawer
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onRefresh={handleQueueRefresh}
          canCancel={canCancel}
          canComplete={canComplete}
          onStartVerification={handleStartVerification}
        />
      )}
    </div>
  );
}
