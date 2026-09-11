import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';

const ProfilePhotoSection = ({ displayPhoto, displayName, onPhotoChange, onRemovePhoto, photoUploading }) => {
  const fileInputRef = useRef(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleFileChange = (e) => {
    const file = e?.target?.files?.[0];
    if (file) onPhotoChange(file);
    if (fileInputRef?.current) fileInputRef.current.value = '';
  };

  const initials = displayName?.split(' ')?.map(n => n?.[0])?.join('')?.substring(0, 2)?.toUpperCase() || 'U';

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-24 h-24 rounded-full border-4 border-card bg-muted flex items-center justify-center overflow-hidden shadow-md">
          {displayPhoto ? (
            <img src={displayPhoto} alt={`${displayName} profile photo`} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-semibold text-muted-foreground">{initials}</span>
          )}
        </div>
        {photoUploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info & Actions */}
      <div className="flex flex-col gap-2 text-center sm:text-left w-full sm:w-auto">
        <p className="text-sm font-medium text-foreground">{displayName || 'Your Name'}</p>
        <p className="text-xs text-muted-foreground">JPG, PNG or GIF · Max 5MB</p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center justify-center sm:justify-start">
          <button
            type="button"
            onClick={() => fileInputRef?.current?.click()}
            disabled={photoUploading}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-1.5 text-sm sm:text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 touch-manipulation min-h-[44px] sm:min-h-0"
          >
            <Icon name="Upload" size={14} />
            Upload Photo
          </button>
          {displayPhoto && (
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(true)}
              disabled={photoUploading}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-1.5 text-sm sm:text-xs font-medium border border-destructive/40 text-destructive rounded-md hover:bg-destructive/10 active:scale-95 transition-all disabled:opacity-50 touch-manipulation min-h-[44px] sm:min-h-0"
            >
              <Icon name="Trash2" size={14} />
              Remove
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Remove Confirm Dialog — slides up from bottom on mobile */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-xl p-6 w-full sm:max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <Icon name="AlertTriangle" size={20} color="var(--color-destructive)" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Remove Photo?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Your profile photo will be removed. This action cannot be undone.</p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted active:scale-95 transition-all touch-manipulation min-h-[44px] sm:min-h-0"
              >
                Cancel
              </button>
              <button
                onClick={() => { onRemovePhoto(); setShowRemoveConfirm(false); }}
                className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium bg-destructive text-white rounded-lg hover:bg-destructive/90 active:scale-95 transition-all touch-manipulation min-h-[44px] sm:min-h-0"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePhotoSection;
