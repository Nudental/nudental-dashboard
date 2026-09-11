import React from 'react';
import Icon from '../../../components/AppIcon';

const ConnectionStatus = ({ isConnected, lastUpdate }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-error'}`} />
      <div className="hidden md:flex flex-col">
        <span className="text-xs font-medium text-foreground">
          {isConnected ? 'Live' : 'Disconnected'}
        </span>
        {isConnected && lastUpdate && (
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdate}
          </span>
        )}
      </div>
      <Icon 
        name={isConnected ? "Wifi" : "WifiOff"} 
        size={14} 
        className={isConnected ? 'text-success' : 'text-error'} 
      />
    </div>
  );
};

export default ConnectionStatus;