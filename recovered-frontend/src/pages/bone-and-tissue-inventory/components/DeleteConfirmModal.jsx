import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { deleteInventoryRecord } from '../../../services/boneTissueService';

const DeleteConfirmModal = ({ record, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteInventoryRecord(record?.id);
      onDeleted();
    } catch (err) {
      setError(err?.message || 'Failed to delete record.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[350] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Icon name="Trash2" size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Delete Record</h3>
            <p className="text-xs text-muted-foreground">This action cannot be undone</p>
          </div>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 mb-4 text-sm space-y-1">
          <div><span className="font-medium">Product:</span> {record?.product_name}</div>
          <div><span className="font-medium">ID:</span> {record?.identification_number || 'N/A'}</div>
          <div><span className="font-medium">Patient:</span> {record?.patient_name}</div>
        </div>
        {error && (
          <p className="text-xs text-red-600 mb-3 flex items-center gap-1">
            <Icon name="AlertCircle" size={12} />{error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 px-4 py-2 text-sm bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {deleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
