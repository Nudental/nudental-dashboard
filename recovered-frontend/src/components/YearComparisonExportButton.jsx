import React, { useState } from 'react';
import Icon from './AppIcon';
import { useYearComparison } from '../contexts/YearComparisonContext';
import { exportYearComparisonCSV, exportYearComparisonPDF } from '../services/yearComparisonExportService';

/**
 * YearComparisonExportButton
 * Renders PDF + CSV export buttons when year filter is active.
 * Props:
 *   officeIds: string[] — optional office filter
 *   reportTitle: string — title for the exported report
 *   compact: boolean — show icon-only buttons
 */
const YearComparisonExportButton = ({
  officeIds = [],
  reportTitle = 'Year Comparison Report',
  compact = false,
}) => {
  const { selectedYears, isYearFilterActive } = useYearComparison();
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  if (!isYearFilterActive) return null;

  const handlePDF = async () => {
    setExportingPDF(true);
    try {
      await exportYearComparisonPDF(selectedYears, officeIds, reportTitle);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleCSV = async () => {
    setExportingCSV(true);
    try {
      await exportYearComparisonCSV(selectedYears, officeIds, reportTitle);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setExportingCSV(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePDF}
        disabled={exportingPDF}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-lg text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        title="Export year comparison as PDF"
      >
        {exportingPDF ? (
          <Icon name="Loader2" size={13} className="animate-spin" />
        ) : (
          <Icon name="FileText" size={13} color="var(--color-primary)" />
        )}
        {!compact && <span>{exportingPDF ? 'Exporting…' : 'PDF'}</span>}
      </button>
      <button
        onClick={handleCSV}
        disabled={exportingCSV}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-lg text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        title="Export year comparison as CSV"
      >
        {exportingCSV ? (
          <Icon name="Loader2" size={13} className="animate-spin" />
        ) : (
          <Icon name="Download" size={13} color="var(--color-primary)" />
        )}
        {!compact && <span>{exportingCSV ? 'Exporting…' : 'CSV'}</span>}
      </button>
    </div>
  );
};

export default YearComparisonExportButton;
