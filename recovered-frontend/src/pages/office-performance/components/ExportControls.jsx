import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const ExportControls = ({ onExport, disabled = false, exporting = false, error = '', success = '' }) => {
  const [exportFormat, setExportFormat] = React.useState('csv');
  const [reportType, setReportType] = React.useState('pl_summary');

  const formatOptions = [
    { value: 'csv', label: 'CSV Format' },
    { value: 'pdf', label: 'PDF Report' },
    { value: 'xlsx', label: 'Excel Spreadsheet' }
  ];

  const reportOptions = [
    { value: 'pl_summary', label: 'P&L Summary' },
    { value: 'executive_summary', label: 'Executive Summary' },
    { value: 'provider_production_collections', label: 'Provider Production & Collections' }
  ];

  const handleExport = () => {
    onExport({ format: exportFormat, reportType });
  };

  return (
    <div id="office-report-export" className="bg-card border border-border rounded-lg p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-foreground mb-4">Export Reports</h3>
      <div className="space-y-4">
        <Select
          label="Export Format"
          options={formatOptions}
          value={exportFormat}
          onChange={setExportFormat}
          disabled={disabled || exporting}
        />
        <Select
          label="Report"
          options={reportOptions}
          value={reportType}
          onChange={setReportType}
          disabled={disabled || exporting}
        />
        <Button
          variant="default"
          fullWidth
          iconName="Download"
          onClick={handleExport}
          loading={exporting}
          disabled={disabled || exporting}
        >
          Generate Report
        </Button>
        {disabled && <p className="text-sm text-muted-foreground">An accessible office and report export permission are required.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {success && <p role="status" className="text-sm text-foreground">{success}</p>}
      </div>
    </div>
  );
};

export default ExportControls;
