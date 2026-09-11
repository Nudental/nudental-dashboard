import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';


/**
 * BookmarkSystem — Saved Analyses
 *
 * Fake/demo saved analyses removed. No hardcoded cards.
 * "Save Current" is kept visible but disabled — saving to a real table is not yet wired.
 */
const BookmarkSystem = ({ onLoadBookmark }) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-elevation-1">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="Bookmark" size={20} color="var(--color-primary)" />
          <h2 className="text-lg font-semibold text-foreground">Saved Analyses</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          iconName="Plus"
          iconPosition="left"
          disabled
          title="Saving verified analyses is not enabled yet."
        >
          Save Current
        </Button>
      </div>

      {/* Disabled save notice */}
      <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-700 italic">
          Saving verified analyses is not enabled yet.
        </p>
      </div>

      {/* Empty state — no fake saved analyses */}
      <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
        <Icon name="BookmarkX" size={20} color="var(--color-muted-foreground)" />
        <p className="text-xs text-muted-foreground">No saved verified analyses yet.</p>
      </div>
    </div>
  );
};

export default BookmarkSystem;