import React from 'react';
import { fmtDate } from '../../../../lib/gusto/gustoFormatters';
import { useGustoEmployeeDetail } from '../../../../hooks/gusto/useGustoEmployees';

function Badge({ badge, className }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {badge}
    </span>
  );
}

export default function GustoEmployeeDrawer({ employeeId, onClose, isSuperAdmin }) {
  const { employee: emp, enrollments, crosswalk, loading } = useGustoEmployeeDetail(employeeId);

  if (!employeeId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#F8F9FA]">
          <div>
            <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
              {loading ? 'Loading…' : `${emp?.first_name || ''} ${emp?.last_name || ''}`}
            </h2>
            <p className="text-xs text-gray-500">{emp?.email || ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-500">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#00B5CC] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !emp ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Employee not found</div>
        ) : (
          <div className="flex-1 p-6 flex flex-col gap-6">
            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <Badge className={emp?.status === 'active' ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}
                badge={emp?.status === 'active' ? 'Active' : 'Terminated'} />
              {emp?.benefits_enrolled && <Badge className="bg-[#DCFCE7] text-[#166534]" badge="Benefits Enrolled" />}
              {emp?.is_fulltime && <Badge className="bg-[#DBEAFE] text-[#1E40AF]" badge="Full-time" />}
            </div>

            {/* Employee fields */}
            <section>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Employee Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Hire Date', fmtDate(emp?.hire_date)],
                  ['Termination Date', emp?.termination_date ? fmtDate(emp?.termination_date) : '—'],
                  ['Employment Type', emp?.employment_type?.replace('_', ' ') || '—'],
                  ['Pay Frequency', emp?.pay_frequency || '—'],
                  ['Payment Method', emp?.payment_method || '—'],
                  ['Work State', emp?.work_state || '—'],
                  ['Gender', emp?.gender || '—'],
                  ['Birthday', emp?.birthday ? fmtDate(emp?.birthday) : '—'],
                  ['Onboarding Status', emp?.onboarding_status || '—'],
                  ['Benefits Eligible', emp?.benefits_eligible ? 'Yes' : 'No'],
                ]?.map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="font-medium text-gray-800">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Benefit enrollments */}
            {enrollments?.length > 0 && (
              <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Benefit Enrollments</h3>
                <div className="flex flex-col gap-2">
                  {enrollments?.map(e => (
                    <div key={e?.id} className="bg-[#F8F9FA] rounded-lg p-3 text-sm">
                      <div className="font-semibold text-gray-800">{e?.gusto_benefit_plans?.plan_name || 'Unknown Plan'}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Employee: ${parseFloat(e?.employee_deduction || 0)?.toFixed(2)} /check ·
                        Company: ${parseFloat(e?.company_contribution || 0)?.toFixed(2)} /check
                      </div>
                      <div className="mt-1">
                        <Badge className={e?.active ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-gray-100 text-gray-500'}
                          badge={e?.active ? 'Active' : 'Inactive'} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Crosswalk mapping */}
            <section>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Dentrix Crosswalk Mapping</h3>
              {crosswalk ? (
                <div className="bg-[#F8F9FA] rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={
                      crosswalk?.mapping_status === 'matched' ? 'bg-[#DCFCE7] text-[#166534]' :
                      crosswalk?.mapping_status === 'review' ? 'bg-[#FEF9C3] text-[#854D0E]' :
                      'bg-gray-100 text-gray-600'
                    } badge={crosswalk?.mapping_status} />
                    {crosswalk?.mapping_confidence && (
                      <span className="text-xs text-gray-400">Confidence: {crosswalk?.mapping_confidence}</span>
                    )}
                  </div>
                  {crosswalk?.dentrix_provider_name && (
                    <div className="text-gray-700">Dentrix: <strong>{crosswalk?.dentrix_provider_name}</strong></div>
                  )}
                  {crosswalk?.role_classification && (
                    <div className="text-xs text-gray-500 mt-1">Role: {crosswalk?.role_classification}</div>
                  )}
                  {crosswalk?.notes && (
                    <div className="text-xs text-gray-400 mt-1 italic">{crosswalk?.notes}</div>
                  )}
                </div>
              ) : (
                <div className="bg-[#FEF9C3] rounded-lg p-3 text-sm text-[#854D0E]">
                  No Dentrix mapping found for this employee.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
