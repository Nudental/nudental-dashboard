import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { restockItem } from '../../../services/boneTissueService';

const RestockModal = ({ record, stockRecord, userId, userName, onClose, onRestocked }) => {
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentStock = stockRecord?.current_stock ?? 0;

  const handleSave = async () => {
    if (!quantity || quantity < 1) {
      setError('Please enter a quantity of at least 1.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await restockItem({
        stockId: stockRecord?.id || null,
        productName: record?.product_name,
        identificationNumber: record?.identification_number,
        officeId: record?.office_id,
        officeName: record?.office_name,
        quantityToAdd: parseInt(quantity, 10),
        userId,
        userName,
      });
      onRestocked();
    } catch (err) {
      setError(err?.message || 'Failed to restock. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Icon name="PackagePlus" size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Restock Item</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]" title={record?.product_name}>
                {record?.product_name || 'Unknown Product'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Current Stock Display */}
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
            <span className="text-sm text-muted-foreground">Current Stock</span>
            <span className={`text-2xl font-bold ${
              currentStock <= 2 ? 'text-red-600' : 'text-emerald-600'
            }`}>
              {currentStock}
              {currentStock <= 2 && (
                <span className="ml-2 text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  Low
                </span>
              )}
            </span>
          </div>

          {/* ID / Serial */}
          {record?.identification_number && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">ID:</span>{' '}
              <span className="font-mono">{record?.identification_number}</span>
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Quantity to Add <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={e => {
                setQuantity(parseInt(e?.target?.value) || 1);
                setError('');
              }}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {quantity > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                New total will be: <span className="font-bold text-emerald-600">{currentStock + parseInt(quantity || 0, 10)}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-1.5">
              <Icon name="AlertCircle" size={12} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || quantity < 1}
            className="flex-1 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Saving…' : 'Add Stock'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestockModal;
