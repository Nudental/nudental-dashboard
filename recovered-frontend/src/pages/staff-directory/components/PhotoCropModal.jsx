import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';

/**
 * PhotoCropModal
 * Native-canvas crop/reposition modal — no external libraries.
 *
 * Props:
 *   imageSrc   {string}  — data URL of the selected image
 *   onCropComplete {fn}  — called with (croppedBlob) when user clicks Save
 *   onCancel   {fn}      — called when user cancels
 */

const PREVIEW_SIZE = 280;   // px — circular preview diameter
const OUTPUT_SIZE  = 512;   // px — saved square canvas

const PhotoCropModal = ({ imageSrc, onCropComplete, onCancel }) => {
  // offset = translation of image center relative to preview center (px)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom]     = useState(1);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 });
  const [saving, setSaving] = useState(false);

  const canvasRef  = useRef(null);
  const imgRef     = useRef(new Image());
  const dragging   = useRef(false);
  const lastPos    = useRef({ x: 0, y: 0 });

  // ── Load image ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const img = imgRef?.current;
    img.onload = () => {
      setImgNaturalSize({ w: img?.naturalWidth, h: img?.naturalHeight });
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // ── Compute clamped offset so image always fills the circle ────────────────
  const clampOffset = useCallback((ox, oy, z) => {
    const { w, h } = imgNaturalSize;
    const scale = Math.min(PREVIEW_SIZE / w, PREVIEW_SIZE / h) * z;
    const scaledW = w * scale;
    const scaledH = h * scale;
    const maxX = Math.max(0, (scaledW - PREVIEW_SIZE) / 2);
    const maxY = Math.max(0, (scaledH - PREVIEW_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  }, [imgNaturalSize]);

  // ── Draw preview canvas ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return;
    const ctx = canvas?.getContext('2d');
    const img = imgRef?.current;
    if (!img?.complete || !img?.naturalWidth) return;

    const { w, h } = imgNaturalSize;
    const baseScale = Math.min(PREVIEW_SIZE / w, PREVIEW_SIZE / h);
    const scale = baseScale * zoom;
    const scaledW = w * scale;
    const scaledH = h * scale;

    ctx?.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Clip to circle
    ctx?.save();
    ctx?.beginPath();
    ctx?.arc(PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, 0, Math.PI * 2);
    ctx?.clip();

    const drawX = (PREVIEW_SIZE - scaledW) / 2 + offset?.x;
    const drawY = (PREVIEW_SIZE - scaledH) / 2 + offset?.y;
    ctx?.drawImage(img, drawX, drawY, scaledW, scaledH);
    ctx?.restore();
  }, [offset, zoom, imgNaturalSize]);

  // ── Pointer drag handlers ──────────────────────────────────────────────────
  const onPointerDown = (e) => {
    dragging.current = true;
    lastPos.current = { x: e?.clientX, y: e?.clientY };
    e?.currentTarget?.setPointerCapture(e?.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging?.current) return;
    const dx = e?.clientX - lastPos?.current?.x;
    const dy = e?.clientY - lastPos?.current?.y;
    lastPos.current = { x: e?.clientX, y: e?.clientY };
    setOffset(prev => clampOffset(prev?.x + dx, prev?.y + dy, zoom));
  };

  const onPointerUp = () => { dragging.current = false; };

  // ── Zoom change ────────────────────────────────────────────────────────────
  const handleZoom = (e) => {
    const z = parseFloat(e?.target?.value);
    setZoom(z);
    setOffset(prev => clampOffset(prev?.x, prev?.y, z));
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // ── Save: render to 512×512 offscreen canvas → Blob ───────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const img = imgRef?.current;
      const { w, h } = imgNaturalSize;
      const baseScale = Math.min(PREVIEW_SIZE / w, PREVIEW_SIZE / h);
      const scale = baseScale * zoom;
      const scaledW = w * scale;
      const scaledH = h * scale;

      // Map preview coords → output coords
      const ratio = OUTPUT_SIZE / PREVIEW_SIZE;
      const drawX = ((PREVIEW_SIZE - scaledW) / 2 + offset?.x) * ratio;
      const drawY = ((PREVIEW_SIZE - scaledH) / 2 + offset?.y) * ratio;

      const offscreen = document.createElement('canvas');
      offscreen.width  = OUTPUT_SIZE;
      offscreen.height = OUTPUT_SIZE;
      const ctx = offscreen?.getContext('2d');

      // Clip to circle on output canvas too (square PNG with transparent circle)
      ctx?.beginPath();
      ctx?.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx?.clip();
      ctx?.drawImage(img, drawX, drawY, scaledW * ratio, scaledH * ratio);

      offscreen?.toBlob(
        (blob) => {
          setSaving(false);
          onCropComplete(blob);
        },
        'image/png',
        1.0
      );
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Icon name="Crop" size={14} color="var(--color-sky-600, #0284c7)" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Position Photo</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">

          {/* Helper text */}
          <p className="text-xs text-muted-foreground text-center">
            Drag and zoom to center the photo before saving.
          </p>

          {/* Circular canvas preview */}
          <div className="flex justify-center">
            <div
              className="rounded-full overflow-hidden border-2 border-primary/40 cursor-grab active:cursor-grabbing select-none"
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            >
              <canvas
                ref={canvasRef}
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{ display: 'block', touchAction: 'none' }}
              />
            </div>
          </div>

          {/* Zoom slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Icon name="ZoomIn" size={12} />
                Zoom
              </label>
              <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="4"
              step="0.05"
              value={zoom}
              onChange={handleZoom}
              className="w-full h-1.5 rounded-full accent-primary cursor-pointer"
            />
          </div>

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <Icon name="RotateCcw" size={12} />
            Reset / Center
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
          >
            Back
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <Icon name="Check" size={12} />
                Use This Crop
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCropModal;
