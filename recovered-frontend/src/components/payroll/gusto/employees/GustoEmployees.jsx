import React, { useState } from 'react';
import GustoEmployeeFilters from './GustoEmployeeFilters';
import GustoEmployeeTable from './GustoEmployeeTable';
import GustoEmployeeDrawer from './GustoEmployeeDrawer';
import { useGustoEmployees } from '../../../../hooks/gusto/useGustoEmployees';
import { downloadCSV, fmtDateCSV } from '../../../../lib/gusto/gustoFormatters';
import { GustoEmptyState } from '../overview/GustoKPICards';

export default function GustoEmployees({ isSuperAdmin }) {
  const [filters, setFilters] = useState({ status: 'all', workState: 'all', employmentType: 'all', benefitsEnrolled: 'all', search: '' });
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const { data, count, loading, error, page, setPage, pageSize } = useGustoEmployees(filters);

  const handleExport = () => {
    const headers = ['ID','First Name','Last Name','Email','Status','Hire Date','Termination Date','Employment Type','Pay Frequency','Payment Method','Work State','Benefits Eligible','Benefits Enrolled'];
    const rows = data?.map(e => [
      e?.id, e?.first_name, e?.last_name, e?.email, e?.status,
      fmtDateCSV(e?.hire_date), fmtDateCSV(e?.termination_date),
      e?.employment_type, e?.pay_frequency, e?.payment_method, e?.work_state,
      String(e?.benefits_eligible ?? ''), String(e?.benefits_enrolled ?? ''),
    ]);
    const today = new Date()?.toISOString()?.split('T')?.[0];
    downloadCSV(`gusto_employees_${today}.csv`, [headers, ...rows]);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
          Employees
        </h2>
        {(isSuperAdmin || true) && (
          <button
            onClick={handleExport}
            disabled={!data?.length}
            className="flex items-center gap-2 px-4 py-2 bg-[#00B5CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0099b0] disabled:opacity-50 transition-colors"
          >
            ↓ Export Employees CSV
          </button>
        )}
      </div>

      <GustoEmployeeFilters filters={filters} onChange={nextFilters => { setPage(0); setFilters(nextFilters); }} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {!loading && !data?.length && !error ? (
        <GustoEmptyState message="No employees match the current filters." />
      ) : (
        <GustoEmployeeTable
          data={data}
          count={count}
          loading={loading}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onRowClick={setSelectedEmployee}
        />
      )}

      {selectedEmployee && (
        <GustoEmployeeDrawer
          employeeId={selectedEmployee?.id}
          onClose={() => setSelectedEmployee(null)}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}
