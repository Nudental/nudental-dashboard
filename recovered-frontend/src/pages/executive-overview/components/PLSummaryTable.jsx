import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const PLSummaryTable = ({ data }) => {
  const [expandedRows, setExpandedRows] = useState([]);

  const toggleRow = (categoryId) => {
    setExpandedRows(prev => 
      prev?.includes(categoryId) 
        ? prev?.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getVarianceColor = (variance) => {
    if (variance > 5) return 'text-success bg-success/10';
    if (variance < -5) return 'text-error bg-error/10';
    return 'text-muted-foreground bg-muted';
  };

  return (
    <div className="bg-card rounded-lg p-4 md:p-6 shadow-elevation-2 border border-border">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-foreground">P&L Summary - Monthly Rollup</h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Budget variance analysis for current period</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-smooth">
            <Icon name="Filter" size={14} />
            <span className="hidden sm:inline">Filter</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-smooth">
            <Icon name="FileText" size={14} />
            <span className="hidden sm:inline">PDF Report</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto -mx-4 md:mx-0">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Actual
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Budget
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  Variance
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  %
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {data?.map((category) => (
                <React.Fragment key={category?.id}>
                  <tr 
                    onClick={() => category?.subcategories && toggleRow(category?.id)}
                    className={`${category?.subcategories ? 'cursor-pointer hover:bg-muted/30' : ''} transition-smooth`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {category?.subcategories && (
                          <Icon 
                            name={expandedRows?.includes(category?.id) ? "ChevronDown" : "ChevronRight"} 
                            size={14} 
                            className="text-muted-foreground"
                          />
                        )}
                        <span className={`text-sm ${category?.isTotal ? 'font-semibold' : 'font-medium'} text-foreground`}>
                          {category?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`text-sm ${category?.isTotal ? 'font-semibold' : ''} text-foreground`}>
                        ${category?.actual?.toLocaleString('en-US')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-sm text-muted-foreground">
                        ${category?.budget?.toLocaleString('en-US')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`text-sm ${category?.variance > 0 ? 'text-success' : category?.variance < 0 ? 'text-error' : 'text-muted-foreground'}`}>
                        ${Math.abs(category?.variance)?.toLocaleString('en-US')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getVarianceColor(category?.variancePercent)}`}>
                        {category?.variancePercent > 0 ? '+' : ''}{category?.variancePercent?.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                  {category?.subcategories && expandedRows?.includes(category?.id) && (
                    category?.subcategories?.map((sub) => (
                      <tr key={sub?.id} className="bg-muted/20">
                        <td className="px-4 py-2 pl-12 whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">{sub?.name}</span>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <span className="text-sm text-foreground">${sub?.actual?.toLocaleString('en-US')}</span>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">${sub?.budget?.toLocaleString('en-US')}</span>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <span className={`text-sm ${sub?.variance > 0 ? 'text-success' : sub?.variance < 0 ? 'text-error' : 'text-muted-foreground'}`}>
                            ${Math.abs(sub?.variance)?.toLocaleString('en-US')}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <span className="text-xs text-muted-foreground">
                            {sub?.variancePercent > 0 ? '+' : ''}{sub?.variancePercent?.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PLSummaryTable;