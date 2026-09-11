import React from 'react';
import Icon from '../../../components/AppIcon';
import { formatComparisonValue, calcPctChange } from '../../../services/yearComparisonService';

/**
 * MultiYearMetricCard — shows a KPI with year-over-year comparison.
 * When only 1 year selected, shows single-year view.
 * When 2-3 years selected, shows side-by-side comparison with % change.
 */
const MultiYearMetricCard = ({
  title,
  metricKey,
  format = 'currency',
  icon,
  iconColor,
  higherIsBetter = true,
  yearKPIMap = {},
  selectedYears = [],
  getYearColor,
}) => {
  const fmt = (val) => formatComparisonValue(val, format);

  const renderSingleYear = () => {
    const year = selectedYears?.[0];
    const value = yearKPIMap?.[year]?.[metricKey] ?? null;
    return (
      <div className="bg-card rounded-lg p-4 md:p-6 shadow-elevation-2 border border-border transition-smooth hover:shadow-elevation-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground font-medium mb-1">{title}</p>
            <h3 className="text-xl md:text-2xl lg:text-3xl font-semibold text-foreground truncate">
              {fmt(value)}
            </h3>
          </div>
          <div
            className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-3"
            style={{ backgroundColor: `${iconColor}15` }}
          >
            <Icon name={icon} size={20} color={iconColor} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
            style={{ backgroundColor: getYearColor(year) }}
          >
            {year}
          </span>
        </div>
      </div>
    );
  };

  const renderMultiYear = () => {
    const sortedYears = [...selectedYears]?.sort((a, b) => b - a);

    return (
      <div className="bg-card rounded-lg p-4 shadow-elevation-2 border border-border transition-smooth hover:shadow-elevation-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium mb-1">{title}</p>
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ml-2"
            style={{ backgroundColor: `${iconColor}15` }}
          >
            <Icon name={icon} size={16} color={iconColor} />
          </div>
        </div>
        <div className="space-y-2">
          {sortedYears?.map((year, idx) => {
            const value = yearKPIMap?.[year]?.[metricKey] ?? null;
            const olderYear = sortedYears?.[idx + 1];
            const olderValue = olderYear !== undefined ? (yearKPIMap?.[olderYear]?.[metricKey] ?? null) : null;
            const pctChange = calcPctChange(value, olderValue);
            const color = getYearColor(year);

            const isPositive = pctChange !== null && pctChange > 0;
            const isNegative = pctChange !== null && pctChange < 0;
            const isGood = higherIsBetter ? isPositive : isNegative;
            const isBad = higherIsBetter ? isNegative : isPositive;

            const changeColor = isGood ? 'text-emerald-600' : isBad ? 'text-red-500' : 'text-muted-foreground';
            const changeIcon = isPositive ? 'TrendingUp' : isNegative ? 'TrendingDown' : 'Minus';

            return (
              <div key={year} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {year}
                  </span>
                  <span className="text-sm font-semibold text-foreground truncate">
                    {fmt(value)}
                  </span>
                </div>
                {pctChange !== null && (
                  <div className={`flex items-center gap-0.5 flex-shrink-0 ${changeColor}`}>
                    <Icon name={changeIcon} size={11} />
                    <span className="text-[10px] font-semibold">
                      {pctChange > 0 ? '+' : ''}{pctChange}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!selectedYears?.length) return null;
  if (selectedYears?.length === 1) return renderSingleYear();
  return renderMultiYear();
};

export default MultiYearMetricCard;
