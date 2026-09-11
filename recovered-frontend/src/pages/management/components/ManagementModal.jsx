import React, { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

// Simple validation helper (Zod-style)
const validate = (schema, values) => {
  const errors = {};
  Object.entries(schema)?.forEach(([field, rules]) => {
    const value = values?.[field];
    if (rules?.required && (!value || (typeof value === 'string' && !value?.trim()))) {
      errors[field] = `${rules?.label || field} is required`;
    } else if (rules?.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(value)) {
      errors[field] = 'Please enter a valid email address';
    } else if (rules?.pattern && value && !rules?.pattern?.test(value)) {
      errors[field] = rules?.patternMessage || `${rules?.label || field} format is invalid`;
    } else if (rules?.minLength && value && value?.length < rules?.minLength) {
      errors[field] = `${rules?.label || field} must be at least ${rules?.minLength} characters`;
    } else if (rules?.maxLength && value && value?.length > rules?.maxLength) {
      errors[field] = `${rules?.label || field} must be at most ${rules?.maxLength} characters`;
    }
  });
  return errors;
};

const ManagementModal = ({
  isOpen,
  onClose,
  title,
  fields,
  validationSchema,
  initialValues,
  onSubmit,
  loading,
  submitLabel = 'Save',
}) => {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const defaults = {};
      fields?.forEach(f => {
        defaults[f.name] = initialValues?.[f?.name] ?? f?.defaultValue ?? '';
      });
      setValues(defaults);
      setErrors({});
      setSubmitError('');
    }
  }, [isOpen, initialValues]);

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors?.[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSubmitError('');
    const validationErrors = validate(validationSchema || {}, values);
    if (Object.keys(validationErrors)?.length > 0) {
      setErrors(validationErrors);
      return;
    }
    try {
      await onSubmit(values);
    } catch (err) {
      setSubmitError(err?.message || 'An error occurred. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          {fields?.map((field) => {
            if (field?.type === 'select') {
              return (
                <Select
                  key={field?.name}
                  label={field?.label}
                  required={field?.required}
                  options={field?.options || []}
                  value={values?.[field?.name] || ''}
                  onChange={(val) => handleChange(field?.name, val)}
                  placeholder={field?.placeholder || `Select ${field?.label}`}
                  error={errors?.[field?.name]}
                />
              );
            }
            return (
              <Input
                key={field?.name}
                label={field?.label}
                type={field?.type || 'text'}
                required={field?.required}
                placeholder={field?.placeholder || ''}
                value={values?.[field?.name] || ''}
                onChange={(e) => handleChange(field?.name, e?.target?.value)}
                error={errors?.[field?.name]}
              />
            );
          })}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              loading={loading}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManagementModal;
