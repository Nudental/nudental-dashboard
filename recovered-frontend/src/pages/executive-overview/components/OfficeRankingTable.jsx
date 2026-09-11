import React from 'react';
import Icon from '../../../components/AppIcon';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const OfficeRankingTable = ({ offices, onOfficeSelect }) => {
  const getPerformanceColor = (status) => {
    if (status === 'excellent') return 'text-success';
    if (status === 'good') return 'text-primary';
    if (status === 'warning') return 'text-warning';
    return 'text-error';
  };

  const getPerformanceIcon = (status) => {
    if (status === 'excellent') return 'TrendingUp';
    if (status === 'good') return 'ArrowUp';
    if (status === 'warning') return 'AlertTriangle';
    return 'AlertCircle';
  };

  return (
    <div className="bg-card rounded-lg p-4 md:p-6 shadow-elevation-2 border border-border">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg font-semibold text-foreground">Office Performance Ranking</h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Real-time location comparison</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-smooth">
          <Icon name="Download" size={14} />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
      <div className="space-y-3">
        {offices?.map((office, index) => (
          <div
            key={office?.id}
            onClick={() => onOfficeSelect && onOfficeSelect(office)}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-smooth cursor-pointer"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground font-semibold text-sm flex-shrink-0">
              {index + 1}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium text-foreground truncate">{office?.name}</h4>
                <Icon 
                  name={getPerformanceIcon(office?.status)} 
                  size={14} 
                  className={getPerformanceColor(office?.status)}
                />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="whitespace-nowrap">Revenue: ${office?.revenue?.toLocaleString('en-US')}</span>
                <span className="whitespace-nowrap">Rate: {office?.collectionRate?.toFixed(1)}%</span>
              </div>
            </div>

            <div className="w-16 h-8 hidden sm:block">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={office?.trend}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke={office?.status === 'excellent' || office?.status === 'good' ? 'var(--color-success)' : 'var(--color-error)'} 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default OfficeRankingTable;