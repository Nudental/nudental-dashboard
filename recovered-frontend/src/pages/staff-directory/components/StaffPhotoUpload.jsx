import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import PhotoCropModal from './PhotoCropModal';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;

const StaffPhotoUpload = ({ staffId, currentPhotoUrl, hasPhoto, onUpload, onRemove, onClose }) => {
  const [rawImageSrc, setRawImageSrc]     = useState(null);   // data URL of selected file
  const [croppedBlob, setCroppedBlob]     = useState(null);   // Blob from crop step
  const [croppedPreview, setCroppedPreview] = useState(null); // object URL for preview
  const [showCrop, setShowCrop]           = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [removing, setRemoving]           = useState(false);
  const [error, setError]                 = useState('');
  const fileInputRef = useRef(null);

  // ── File selection → open crop modal ──────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setError('');

    if (!ALLOWED_TYPES?.includes(file?.type)) {
      setError('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }
    if (file?.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Photo must be under ${MAX_SIZE_MB} MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawImageSrc(ev?.target?.result);
      setShowCrop(true);
    };
    reader?.readAsDataURL(file);

    // Reset input so same file can be re-selected after cancel
    e.target.value = '';
  };

  // ── Crop complete → store blob + preview ──────────────────────────────────
  const handleCropComplete = (blob) => {
    setCroppedBlob(blob);
    if (croppedPreview) URL.revokeObjectURL(croppedPreview);
    setCroppedPreview(URL.createObjectURL(blob));
    setShowCrop(false);
    setRawImageSrc(null);
  };

  const handleCropCancel = () => {
    setShowCrop(false);
    setRawImageSrc(null);
  };

  // ── Re-crop existing selection ─────────────────────────────────────────────
  const handleReCrop = () => {
    if (rawImageSrc) {
      setShowCrop(true);
    } else {
      fileInputRef?.current?.click();
    }
  };

  // ── Upload cropped blob ────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!croppedBlob) return;
    setUploading(true);
    setError('');
    try {
      // Wrap blob in a File so the service receives a proper File object
      const file = new File([croppedBlob], 'staff-photo.png', { type: 'image/png' });
      await onUpload(staffId, file);
      if (croppedPreview) URL.revokeObjectURL(croppedPreview);
      onClose();
    } catch (ex) {
      setError(ex?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError('');
    try {
      await onRemove(staffId);
      onClose();
    } catch (ex) {
      setError(ex?.message || 'Remove failed. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  // ── Display source: cropped preview > current signed URL ──────────────────
  const displaySrc = croppedPreview || currentPhotoUrl;

  return (
    <>
      {/* Crop modal — rendered above this modal (z-[60]) */}
      {showCrop && rawImageSrc && (
        <PhotoCropModal
          imageSrc={rawImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                <Icon name="Camera" size={14} color="var(--color-sky-600, #0284c7)" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Staff Photo</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="X" size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
                <Icon name="AlertCircle" size={13} color="var(--color-destructive)" className="flex-shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* Photo preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-28 h-28 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center">
                {displaySrc ? (
                  <img src={displaySrc} alt="Staff photo preview" className="w-full h-full object-cover" />
                ) : (
                  <Icon name="User" size={40} color="var(--color-muted-foreground)" />
                )}
              </div>
              {croppedPreview && (
                <p className="text-xs text-muted-foreground">Cropped preview — not yet saved</p>
              )}
            </div>

            {/* File input / re-crop */}
            {croppedPreview ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleReCrop}
                  className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-xl p-3 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground transition-colors"
                >
                  <Icon name="Crop" size={14} />
                  Edit Crop / Replace Photo
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef?.current?.click()}
              >
                <Icon name="Upload" size={20} color="var(--color-muted-foreground)" className="mx-auto mb-1.5" />
                <p className="text-sm font-medium text-foreground">Click to select photo</p>
                <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, or WebP · Max 5 MB</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />

            <p className="text-xs text-muted-foreground text-center">
              Photos are stored privately. No public links are generated.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
            {hasPhoto && !croppedPreview && (
              <button
                onClick={handleRemove}
                disabled={removing || uploading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 disabled:opacity-50 transition-colors"
              >
                {removing ? (
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : <Icon name="Trash2" size={12} />}
                Remove Photo
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!croppedBlob || uploading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading…
                </>
              ) : (
                <>
                  <Icon name="Upload" size={12} />
                  {hasPhoto ? 'Replace Photo' : 'Upload Photo'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default StaffPhotoUpload;
