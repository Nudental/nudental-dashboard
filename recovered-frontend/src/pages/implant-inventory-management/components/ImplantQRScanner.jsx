import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Icon from '../../../components/AppIcon';

const SCANNER_ID = 'implant-qr-scanner-region';

const ImplantQRScanner = ({ onScanned, onClose }) => {
  const [scannerError, setScannerError] = useState('');
  const [scanSuccess, setScanSuccess] = useState(false);
  const [starting, setStarting] = useState(true);
  const [scannedRaw, setScannedRaw] = useState('');
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
  }, []);

  const parseScannedData = (raw) => {
    const result = { identificationNumber: raw, lotNumber: '', skuReference: '', expirationDate: '' };
    // Try to parse structured data (e.g., GS1 DataMatrix or JSON-like)
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.id || parsed?.identification_number) result.identificationNumber = parsed?.id || parsed?.identification_number;
      if (parsed?.lot || parsed?.lot_number) result.lotNumber = parsed?.lot || parsed?.lot_number;
      if (parsed?.sku || parsed?.ref) result.skuReference = parsed?.sku || parsed?.ref;
      if (parsed?.exp || parsed?.expiration_date) result.expirationDate = parsed?.exp || parsed?.expiration_date;
      return result;
    } catch (_) {}
    // Try GS1 Application Identifiers
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

  const startScanner = useCallback(async () => {
    if (mountedRef?.current) return;
    mountedRef.current = true;
    setScannerError('');
    setStarting(true);
    try {
      const el = document?.getElementById(SCANNER_ID);
      if (!el) { setScannerError('Scanner element not found'); setStarting(false); return; }
      html5QrRef.current = new Html5Qrcode(SCANNER_ID);
      await html5QrRef?.current?.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 180 } },
        (decodedText) => {
          const parsed = parseScannedData(decodedText);
          setScannedRaw(decodedText);
          setScanSuccess(true);
          stopScanner();
          onScanned?.(parsed);
        },
        () => {}
      );
      setStarting(false);
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg?.toLowerCase()?.includes('permission') || msg?.toLowerCase()?.includes('denied')) {
        setScannerError('Camera access denied. Please allow camera access and try again.');
      } else {
        setScannerError('Could not start camera. Please enter the ID number manually.');
      }
      setStarting(false);
      mountedRef.current = false;
    }
  }, [onScanned, stopScanner]);

  useEffect(() => {
    const timer = setTimeout(startScanner, 200);
    return () => {
      clearTimeout(timer);
      stopScanner();
      mountedRef.current = false;
    };
  }, []);

  const handleRescan = () => {
    setScanSuccess(false);
    setScannedRaw('');
    setScannerError('');
    mountedRef.current = false;
    startScanner();
  };

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <div className="flex items-center gap-2">
          <Icon name="ScanLine" size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold text-white">QR / Barcode Scanner</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors">
          <Icon name="X" size={14} />
        </button>
      </div>

      <div className="p-4">
        {scanSuccess ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Icon name="CheckCircle" size={28} className="text-emerald-400" />
            </div>
            <p className="text-emerald-400 font-semibold text-sm mb-1">Code captured successfully!</p>
            <p className="text-gray-400 text-xs mb-4 break-all">{scannedRaw?.slice(0, 60)}{scannedRaw?.length > 60 ? '…' : ''}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={handleRescan} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors flex items-center gap-1">
                <Icon name="RefreshCw" size={12} /> Rescan
              </button>
              <button onClick={onClose} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1">
                <Icon name="Check" size={12} /> Use Value
              </button>
            </div>
          </div>
        ) : scannerError ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Icon name="AlertCircle" size={28} className="text-red-400" />
            </div>
            <p className="text-red-400 font-semibold text-sm mb-1">Scanner Error</p>
            <p className="text-gray-400 text-xs mb-4">{scannerError}</p>
            <button onClick={handleRescan} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors flex items-center gap-1 mx-auto">
              <Icon name="RefreshCw" size={12} /> Try Again
            </button>
          </div>
        ) : (
          <>
            {starting && (
              <div className="flex items-center justify-center py-4 gap-2 text-gray-400">
                <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Starting camera…</span>
              </div>
            )}
            <div id={SCANNER_ID} className="w-full rounded-lg overflow-hidden" style={{ minHeight: 200 }} />
            <p className="text-center text-gray-400 text-xs mt-3">Point camera at QR code or barcode</p>
            <p className="text-center text-gray-500 text-xs">Supports QR, Code 128, Code 39, EAN, UPC, Data Matrix</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ImplantQRScanner;
