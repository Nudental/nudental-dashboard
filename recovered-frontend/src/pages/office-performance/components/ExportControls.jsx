import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const ExportControls = ({ onExport }) => {
  const [exportFormat, setExportFormat] = React.useState('csv');
  const [reportTemplate, setReportTemplate] = React.useState('standard');

  const formatOptions = [
    { value: 'csv', label: 'CSV Format' },
    { value: 'pdf', label: 'PDF Report' },
    { value: 'excel', label: 'Excel Spreadsheet' }
  ];

  const templateOptions = [
    { value: 'standard', label: 'Standard Report' },
    { value: 'detailed', label: 'Detailed Analysis' },
    { value: 'summary', label: 'Executive Summary' },
    { value: 'custom', label: 'Custom Template' }
  ];

  const handleExport = () => {
    onExport({ format: exportFormat, template: reportTemplate });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-foreground mb-4">Export Reports</h3>
      <div className="space-y-4">
        <Select
          label="Export Format"
          options={formatOptions}
          value={exportFormat}
          onChange={setExportFormat}
        />
        <Select
          label="Report Template"
          options={templateOptions}
          value={reportTemplate}
          onChange={setReportTemplate}
        />
        <Button
          variant="default"
          fullWidth
          iconName="Download"
          onClick={handleExport}
        >
          Generate Report
        </Button>
      </div>
    </div>
  );
};

export default ExportControls;