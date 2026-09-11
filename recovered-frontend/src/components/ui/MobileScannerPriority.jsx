import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Icon from '../AppIcon';

const SCANNER_ID = 'mobile-priority-scanner-region';

const parseScannedData = (raw) => {
  const result = { identificationNumber: raw, lotNumber: '', skuReference: '', expirationDate: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.id || parsed?.identification_number) result.identificationNumber = parsed?.id || parsed?.identification_number;
    if (parsed?.lot || parsed?.lot_number) result.lotNumber = parsed?.lot || parsed?.lot_number;
    if (parsed?.sku || parsed?.ref) result.skuReference = parsed?.sku || parsed?.ref;
    if (parsed?.exp || parsed?.expiration_date) result.expirationDate = parsed?.exp || parsed?.expiration_date;
    return result;
  } catch (_) {}
  const ai01 = raw?.match(/\(01\)(\d{14})/);
  const ai10 = raw?.match(/\(10\)([^(]+)/);
  const ai17 = raw?.match(/\(17\)(\d{6})/);
  const ai21 = raw?.match(/\(21\)([^(]+)/);
  if (ai21) result.identificationNumber = ai21?.[1]?.trim();
  else if (ai01) result.identificationNumber = ai01?.[1]?.trim();
  if (ai10) result.lotNumber = ai10?.[1]?.trim();
  if (ai17) {
    const d = ai17?.[1];
    result.expirationDate = `20${d?.slice(0,2)}-${d?.slice(2,4)}-${d?.slice(4,6)}`;
  }
  return result;
};

const MobileScannerPriority = ({ onScanned, onManualEntry, autoOpen = false }) => {
  const [phase, setPhase] = useState(autoOpen ? 'scanning' : 'idle'); // idle | scanning | success | error
  const [scannedRaw, setScannedRaw] = useState('');
  const [scannedParsed, setScannedParsed] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [starting, setStarting] = useState(false);
  const html5QrRef = useRef(null);
  const mountedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (html5QrRef?.current) {
      try {
        const state = html5QrRef?.current?.getState?.();
        if (state === 2) await html5QrRef?.current?.stop();
        html5QrRef?.current?.clear?.();
      } catch (_) {}
      html5QrRef.current = null;
    }
    mountedRef.current = false;
  }, []);

  const startScanner = useCallback(async () => {
    if (mountedRef?.current) return;
    mountedRef.current = true;
    setErrorMsg('');
    setStarting(true);

    await new Promise(r => setTimeout(r, 200));

    try {
      await navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (_) {
      setErrorMsg('Camera access denied. Please allow camera access.');
      setPhase('error');
      setStarting(false);
      mountedRef.current = false;
      return;
    }

    try {
      const el = document.getElementById(SCANNER_ID);
      if (!el) { setErrorMsg('Scanner not ready.'); setPhase('error'); setStarting(false); mountedRef.current = false; return; }

      html5QrRef.current = new Html5Qrcode(SCANNER_ID);
      await html5QrRef?.current?.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 180 } },
        (decodedText) => {
          const parsed = parseScannedData(decodedText);
          setScannedRaw(decodedText);
          setScannedParsed(parsed);
          stopScanner();
          setPhase('success');
          // Haptic feedback
          if (navigator.vibrate) navigator.vibrate(200);
        },
        () => {}
      );
      setStarting(false);
    } catch (err) {
      const msg = err?.message || '';
      if (msg?.toLowerCase()?.includes('permission') || msg?.toLowerCase()?.includes('denied')) {
        setErrorMsg('Camera access denied.');
      } else {
        setErrorMsg('Could not start camera.');
      }
      setPhase('error');
      setStarting(false);
      mountedRef.current = false;
    }
  }, [stopScanner]);

  useEffect(() => {
    if (phase === 'scanning') {
      startScanner();
    }
    return () => {
      if (phase !== 'scanning') stopScanner();
    };
  }, [phase]);

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const handleUseValue = () => {
    if (scannedParsed) onScanned?.(scannedParsed);
  };

  const handleRescan = () => {
    setScannedRaw('');
    setScannedParsed(null);
    setErrorMsg('');
    mountedRef.current = false;
    setPhase('scanning');
  };

  if (phase === 'idle') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setPhase('scanning')}
          className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white rounded-2xl font-bold text-base transition-colors hover:bg-gray-800 active:scale-95"
          style={{ minHeight: '64px' }}
        >
          <Icon name="Camera" size={24} />
          Scan QR / Barcode
        </button>
        <button
          type="button"
          onClick={onManualEntry}
          className="w-full flex items-center justify-center gap-2 text-muted-foreground text-sm py-3"
        >
          <Icon name="Keyboard" size={16} />
          Enter manually instead
        </button>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <div className="p-5 text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icon name="CheckCircle" size={32} className="text-emerald-400" />
          </div>
          <p className="text-emerald-400 font-bold text-base mb-1">Code captured!</p>
          <p className="text-gray-400 text-sm mb-1 break-all">{scannedRaw?.slice(0, 60)}{scannedRaw?.length > 60 ? '…' : ''}</p>
          {scannedParsed?.lotNumber && <p className="text-gray-500 text-xs">Lot: {scannedParsed?.lotNumber}</p>}
          {scannedParsed?.expirationDate && <p className="text-gray-500 text-xs">Exp: {scannedParsed?.expirationDate}</p>}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={handleRescan}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gray-700 text-white rounded-xl text-sm font-semibold"
            style={{ minHeight: '52px' }}
          >
            <Icon name="RefreshCw" size={16} /> Rescan
          </button>
          <button
            type="button"
            onClick={handleUseValue}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold"
            style={{ minHeight: '52px' }}
          >
            <Icon name="Check" size={16} /> Use Scanned Value
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="bg-gray-900 rounded-2xl p-5 text-center">
        <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <Icon name="CameraOff" size={28} className="text-red-400" />
        </div>
        <p className="text-red-400 font-semibold text-sm mb-1">Scanner Error</p>
        <p className="text-gray-400 text-xs mb-4">{errorMsg}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRescan}
            className="flex-1 py-3 bg-gray-700 text-white rounded-xl text-sm font-semibold"
            style={{ minHeight: '48px' }}
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={onManualEntry}
            className="flex-1 py-3 bg-gray-600 text-white rounded-xl text-sm font-semibold"
            style={{ minHeight: '48px' }}
          >
            Enter Manually
          </button>
        </div>
      </div>
    );
  }

  // Scanning phase
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <div className="flex items-center gap-2">
          <Icon name="ScanLine" size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white">Scanning…</span>
        </div>
        <button
          type="button"
          onClick={() => { stopScanner(); setPhase('idle'); }}
          className="p-2 rounded-lg hover:bg-gray-700 text-gray-300"
          style={{ minWidth: 40, minHeight: 40 }}
        >
          <Icon name="X" size={16} />
        </button>
      </div>

      {starting && (
        <div className="flex flex-col items-center justify-center gap-3 bg-gray-950" style={{ height: '40vw', minHeight: 200 }}>
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400">Starting camera…</p>
        </div>
      )}

      <div
        id={SCANNER_ID}
        className="w-full"
        style={{ minHeight: starting ? 0 : '60vw', maxHeight: '60vh' }}
      />

      {!starting && (
        <div className="px-4 py-3 bg-gray-800 text-center">
          <p className="text-xs text-gray-400">Point camera at QR code or barcode</p>
          <p className="text-xs text-gray-500 mt-0.5">QR · Code 128 · Code 39 · EAN · UPC · Data Matrix</p>
        </div>
      )}

      <div className="px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={onManualEntry}
          className="w-full py-3 text-gray-400 text-sm text-center"
        >
          Enter manually instead
        </button>
      </div>
    </div>
  );
};

export default MobileScannerPriority;
