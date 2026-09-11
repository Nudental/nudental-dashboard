import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '../../../../components/AppIcon';
import NumericKeypad from '../../../../components/ui/NumericKeypad';
import supplyRequestService from '../../../../services/supplyRequestService';
import { offlineQueueService } from '../../../../services/offlineQueueService';
import { useAuth } from '../../../../contexts/AuthContext';

// ── Inline barcode scanner using html5-qrcode ─────────────────────────────
const BarcodeScanner = ({ onScan, onClose }) => {
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);
  const [scanError, setScanError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);

  useEffect(() => {
    let html5QrCode;
    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode('supply-barcode-reader');
        scannerInstanceRef.current = html5QrCode;
        setScanning(true);
        await html5QrCode?.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            setLastScanned(decodedText);
            if (navigator.vibrate) navigator.vibrate(200);
          },
          () => {}
        );
      } catch (err) {
        setScanError('Camera unavailable — please enter manually');
        setScanning(false);
      }
    };
    startScanner();
    return () => {
      if (scannerInstanceRef?.current) {
        scannerInstanceRef?.current?.stop()?.catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-3 bg-black">
        <span className="text-white font-semibold text-sm">Scan Item Barcode</span>
        <button onClick={onClose} className="p-2 text-white"><Icon name="X" size={20} /></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div id="supply-barcode-reader" ref={scannerRef} className="w-full max-w-sm rounded-xl overflow-hidden" />
        {scanError && (
          <div className="mt-4 px-4 py-3 bg-red-900/80 rounded-xl text-red-200 text-sm text-center">{scanError}</div>
        )}
        {lastScanned && (
          <div className="mt-4 w-full max-w-sm bg-white rounded-2xl p-4 space-y-3">
            <p className="text-xs text-gray-500 font-semibold">Scanned Code</p>
            <p className="text-base font-bold text-gray-900 break-all">{lastScanned}</p>
            <div className="flex gap-2">
              <button
                onClick={() => { onScan(lastScanned); onClose(); }}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold"
              >
                Use Scanned Value
              </button>
              <button
                onClick={() => setLastScanned(null)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold"
              >
                Rescan
              </button>
            </div>
          </div>
        )}
        {!lastScanned && scanning && (
          <p className="mt-4 text-gray-300 text-sm text-center">Point camera at item barcode or QR code</p>
        )}
      </div>
    </div>
  );
};

// ── Item Row ─────────────────────────────────────────────────────────────
const ItemRow = ({ item, isActive, receivedQty, onSelect, onQtyChange, onScanClick }) => {
  const qtySupplied = item?.qty_supplied || 0;
  const isOver = receivedQty > qtySupplied;
  const isMatch = receivedQty > 0 && receivedQty === qtySupplied;

  return (
    <div
      className={`rounded-2xl border-2 transition-all ${
        isActive ? 'border-blue-500 bg-blue-50/50' : 'border-border bg-card'
      }`}
    >
      {/* Row header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => onSelect(item?.id)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{item?.item_name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {item?.dept_name && (
              <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                {item?.dept_name?.split('/')?.[0]?.trim()}
              </span>
            )}
            {item?.subsection_name && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                {item?.subsection_name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-muted-foreground">Approved: <span className="font-semibold text-foreground">{item?.qty_approved || 0}</span></span>
            <span className="text-xs text-blue-600">Supplied: <span className="font-semibold">{qtySupplied}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={e => { e?.stopPropagation(); onScanClick(item?.id); }}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            <Icon name="Scan" size={13} />Scan
          </button>
          <div
            className={`flex items-center justify-center rounded-xl border-2 text-lg font-bold ${
              receivedQty > 0 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border bg-muted text-muted-foreground'
            }`}
            style={{ minWidth: '52px', minHeight: '52px' }}
          >
            {receivedQty}
          </div>
          <Icon name={isActive ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground" />
        </div>
      </div>
      {/* Expanded keypad */}
      {isActive && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          <p className="text-xs text-muted-foreground font-semibold">Max: {qtySupplied} units</p>
          <NumericKeypad
            value={receivedQty}
            onChange={onQtyChange}
            label={`Enter received qty (max ${qtySupplied})`}
            min={0}
            max={9999}
            allowDecimal={false}
          />
          {isOver && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl">
              <Icon name="AlertTriangle" size={14} className="text-orange-600 flex-shrink-0" />
              <span className="text-xs text-orange-700 font-semibold">Exceeds supplied quantity</span>
            </div>
          )}
          {isMatch && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
              <Icon name="CheckCircle" size={14} className="text-emerald-600 flex-shrink-0" />
              <span className="text-xs text-emerald-700 font-semibold">✓ Matches supplied</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Modal ────────────────────────────────────────────────────────────
const MobileReceiveSuppliesModal = ({ fulfillmentBatch, onClose, onSaved }) => {
  const { userProfile } = useAuth();
  const [items, setItems] = useState([]);
  const [receivedQtys, setReceivedQtys] = useState({});
  const [activeItemId, setActiveItemId] = useState(null);
  const [notes, setNotes] = useState('');
  const [receivedBy, setReceivedBy] = useState(userProfile?.full_name || '');
  const [dateReceived, setDateReceived] = useState(new Date()?.toISOString()?.split('T')?.[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanTargetItemId, setScanTargetItemId] = useState(null);
  const [scanToast, setScanToast] = useState('');
  const startY = useRef(0);

  // Build items list from fulfillmentBatch
  useEffect(() => {
    if (fulfillmentBatch) {
      // If batch has items array, use it; otherwise treat single log as one item
      const batchItems = fulfillmentBatch?.items || [fulfillmentBatch];
      const normalized = batchItems?.map(i => ({
        id: i?.id,
        item_name: i?.item_name || 'Unknown Item',
        item_id: i?.item_id,
        dept_name: i?.supply_departments?.name || i?.dept_name || '',
        subsection_name: i?.supply_subsections?.name || i?.subsection_name || '',
        qty_approved: i?.qty_approved || 0,
        qty_supplied: i?.qty_supplied || 0,
        sku: i?.sku || i?.supply_items?.sku || '',
        lot_number: i?.lot_number || '',
        office_id: i?.office_id || fulfillmentBatch?.office_id,
        request_item_id: i?.request_item_id,
      }));
      setItems(normalized);
      // Init received qtys to 0
      const initQtys = {};
      normalized?.forEach(it => { initQtys[it?.id] = 0; });
      setReceivedQtys(initQtys);
    }
  }, [fulfillmentBatch]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.body.style.overflow = '';
    };
  }, []);

  // Swipe-down dismiss
  const handleTouchStart = (e) => { startY.current = e?.touches?.[0]?.clientY; setIsDragging(true); };
  const handleTouchMove = (e) => { if (!isDragging) return; const d = e?.touches?.[0]?.clientY - startY?.current; if (d > 0) setDragY(d); };
  const handleTouchEnd = () => { setIsDragging(false); if (dragY > 120) onClose(); else setDragY(0); };

  const handleSelectItem = (itemId) => {
    setActiveItemId(prev => prev === itemId ? null : itemId);
  };

  const handleQtyChange = (itemId, qty) => {
    setReceivedQtys(prev => ({ ...prev, [itemId]: qty }));
  };

  const handleScanClick = (itemId) => {
    setScanTargetItemId(itemId);
    setShowScanner(true);
  };

  const handleScanResult = useCallback((scannedCode) => {
    // Try to match against item SKU or lot number
    const matched = items?.find(it =>
      (it?.sku && it?.sku?.toLowerCase() === scannedCode?.toLowerCase()) ||
      (it?.lot_number && it?.lot_number?.toLowerCase() === scannedCode?.toLowerCase()) ||
      (scanTargetItemId && it?.id === scanTargetItemId)
    );
    if (matched) {
      setActiveItemId(matched?.id);
      setScanToast(`Item found: ${matched?.item_name}`);
    } else {
      setScanToast('Item not found — please select manually');
    }
    setTimeout(() => setScanToast(''), 3000);
    setShowScanner(false);
    setScanTargetItemId(null);
  }, [items, scanTargetItemId]);

  const confirmedCount = Object.values(receivedQtys)?.filter(q => q > 0)?.length;
  const hasAnyQty = confirmedCount > 0;

  const handleConfirm = async () => {
    if (!hasAnyQty) { setError('Please enter received quantity for at least one item'); return; }
    setSaving(true);
    setError('');

    const itemsPayload = items
      ?.filter(it => (receivedQtys?.[it?.id] || 0) > 0)
      ?.map(it => ({
        id: it?.id,
        item_id: it?.item_id,
        item_name: it?.item_name,
        received_qty: receivedQtys?.[it?.id] || 0,
        qty_supplied: it?.qty_supplied,
        office_id: it?.office_id,
        request_item_id: it?.request_item_id,
      }));

    const payload = {
      fulfillment_log_id: fulfillmentBatch?.id,
      office_id: fulfillmentBatch?.office_id,
      items: itemsPayload,
      received_by: receivedBy,
      date_received: dateReceived,
      notes,
      created_at: new Date()?.toISOString(),
    };

    try {
      if (isOffline) {
        await offlineQueueService?.enqueue('supply_receipt', payload);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        onSaved?.({ offline: true, count: itemsPayload?.length });
      } else {
        await supplyRequestService?.receiveSupplies(payload);
        if (navigator.vibrate) navigator.vibrate(200);
        onSaved?.({ offline: false, count: itemsPayload?.length, office: fulfillmentBatch?.office_id });
      }
    } catch (e) {
      setError(e?.message || 'Failed to confirm receipt');
    } finally {
      setSaving(false);
    }
  };

  const batchRef = fulfillmentBatch?.id?.slice(0, 8)?.toUpperCase() || 'N/A';
  const officeName = fulfillmentBatch?.office_id?.split(' ')?.slice(-1)?.[0] || fulfillmentBatch?.office_id || '';

  return (
    <>
      {showScanner && (
        <BarcodeScanner
          onScan={handleScanResult}
          onClose={() => { setShowScanner(false); setScanTargetItemId(null); }}
        />
      )}

      <div className="fixed inset-0 z-[700] flex flex-col justify-end">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Sheet */}
        <div
          className="relative bg-card rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh] transition-transform"
          style={{ transform: `translateY(${dragY}px)` }}
        >
          {/* Drag handle */}
          <div
            className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between px-5 py-3 border-b border-border">
            <div>
              <h2 className="text-base font-bold text-foreground">Receive Supplies</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground">{officeName}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-mono text-blue-600">#{batchRef}</span>
                {fulfillmentBatch?.date_supplied && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{fulfillmentBatch?.date_supplied}</span>
                  </>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl flex-shrink-0">
              <Icon name="X" size={18} />
            </button>
          </div>

          {/* Scan toast */}
          {scanToast && (
            <div className={`mx-5 mt-3 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${
              scanToast?.includes('not found') ? 'bg-orange-50 border border-orange-200 text-orange-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}>
              <Icon name={scanToast?.includes('not found') ? 'AlertTriangle' : 'CheckCircle'} size={14} />
              {scanToast}
            </div>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Item list */}
            {items?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Icon name="Package" size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No items in this fulfillment batch</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items?.map(item => (
                  <ItemRow
                    key={item?.id}
                    item={item}
                    isActive={activeItemId === item?.id}
                    receivedQty={receivedQtys?.[item?.id] || 0}
                    onSelect={handleSelectItem}
                    onQtyChange={(qty) => handleQtyChange(item?.id, qty)}
                    onScanClick={handleScanClick}
                  />
                ))}
              </div>
            )}

            {/* Running total */}
            {items?.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-2xl">
                <span className="text-sm text-muted-foreground font-medium">Items confirmed</span>
                <span className="text-sm font-bold text-foreground">{confirmedCount} of {items?.length}</span>
              </div>
            )}

            {/* Received By + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Received By</label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={e => setReceivedBy(e?.target?.value)}
                  className="w-full px-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  style={{ minHeight: '52px', fontSize: '16px' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Date Received</label>
                <input
                  type="date"
                  value={dateReceived}
                  onChange={e => setDateReceived(e?.target?.value)}
                  className="w-full px-3 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  style={{ minHeight: '52px', fontSize: '16px' }}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Delivery Notes / Discrepancies</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e?.target?.value)}
                rows={4}
                placeholder="Note any missing items, damaged goods, or delivery issues..."
                className="w-full px-4 py-3 border border-border rounded-2xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* Offline banner */}
            {isOffline && (
              <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
                <Icon name="WifiOff" size={16} className="text-yellow-700 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800 font-medium">
                  You are offline — receipt will sync when connected
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                <Icon name="AlertCircle" size={14} />{error}
              </div>
            )}
          </div>

          {/* Fixed bottom action bar */}
          <div
            className="px-5 py-4 border-t border-border bg-card flex gap-3"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={onClose}
              className="flex-1 border border-border rounded-2xl text-sm font-semibold text-foreground hover:bg-muted"
              style={{ minHeight: '52px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || !hasAnyQty}
              className="flex-1 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ minHeight: '56px' }}
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
              ) : (
                <><Icon name="CheckCircle" size={16} />{isOffline ? 'Queue Receipt' : 'Confirm Receipt'}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileReceiveSuppliesModal;
