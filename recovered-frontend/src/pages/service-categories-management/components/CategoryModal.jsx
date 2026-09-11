import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const CategoryModal = ({ isOpen, onClose, editRow, onSubmit, loading, offices, isSuperAdmin, userOfficeId }) => {
  const [values, setValues] = useState({ name: '', description: '', is_active: true, office_id: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValues({
        name: editRow?.name || '',
        description: editRow?.description || '',
        is_active: editRow ? (editRow?.is_active ?? true) : true,
        office_id: editRow?.office_id || (isSuperAdmin ? '' : userOfficeId || ''),
      });
      setErrors({});
      setSubmitError('');
    }
  }, [isOpen, editRow, isSuperAdmin, userOfficeId]);

  const handleChange = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
    if (errors?.[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (submitError) setSubmitError('');
  };

  const validate = () => {
    const errs = {};
    if (!values?.name?.trim()) errs.name = 'Category name is required';
    else if (values?.name?.trim()?.length < 2) errs.name = 'Name must be at least 2 characters';
    else if (values?.name?.trim()?.length > 100) errs.name = 'Name must be at most 100 characters';
    return errs;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError('');
    const errs = validate();
    if (Object.keys(errs)?.length > 0) { setErrors(errs); return; }
    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitError(err?.message || 'An error occurred. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Tag" size={16} color="var(--color-primary)" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {editRow ? 'Edit Service Category' : 'Add New Category'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {submitError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <Icon name="AlertCircle" size={16} color="var(--color-destructive)" className="flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          <Input
            label="Category Name"
            required
            placeholder="e.g. Implants, Botox, General Dentistry"
            value={values?.name || ''}
            onChange={(e) => handleChange('name', e?.target?.value)}
            error={errors?.name}
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              value={values?.description || ''}
              onChange={(e) => handleChange('description', e?.target?.value)}
              placeholder="Brief description of this service category..."
              rows={3}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none transition-colors"
            />
          </div>

          {/* Office Selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Assigned Office
              {!isSuperAdmin && <span className="text-muted-foreground font-normal ml-1">(your office)</span>}
            </label>
            {isSuperAdmin ? (
              <select
                value={values?.office_id || ''}
                onChange={(e) => handleChange('office_id', e?.target?.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Offices (Global)</option>
                {offices?.map(o => (
                  <option key={o?.id} value={o?.id}>{o?.name}</option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2.5 border border-border rounded-lg bg-muted/30 text-sm text-muted-foreground">
                {offices?.find(o => o?.id === userOfficeId)?.name || 'Your assigned office'}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Duplicate names are checked per office (case-insensitive)
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Active Status</p>
              <p className="text-xs text-muted-foreground">Active categories appear in service dropdowns</p>
            </div>
            <button
              type="button"
              onClick={() => handleChange('is_active', !values?.is_active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                values?.is_active ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                values?.is_active ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" variant="default" loading={loading}>
              {editRow ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryModal;
