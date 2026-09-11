import React from 'react';
import Icon from '../../../components/AppIcon';

const SubmissionConfirmation = ({ trackingNumber, entryDate, onNewEntry }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
        <Icon name="Clock" size={32} color="var(--color-warning)" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">Entry Submitted Successfully</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Your entry has been submitted and is pending approval. An administrator will review it shortly.
      </p>

      <div className="w-full max-w-sm bg-muted/50 border border-border rounded-xl p-5 mb-6 text-left">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="ClipboardCheck" size={16} color="var(--color-primary)" />
          <span className="text-sm font-semibold text-foreground">Submission Details</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tracking Number</span>
            <span className="font-mono font-semibold text-primary">{trackingNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Entry Date</span>
            <span className="font-medium text-foreground">{entryDate}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-semibold border border-warning/20">
              <Icon name="Clock" size={11} />
              Pending Approval
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onNewEntry}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-smooth focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <Icon name="Plus" size={16} />
        Start New Entry
      </button>
    </div>
  );
};

export default SubmissionConfirmation;
