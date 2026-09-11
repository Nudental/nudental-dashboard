import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const ManagementTable = ({
  title,
  columns,
  data,
  loading,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
  showActiveToggle,
  extraRowActions,
}) => {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <Button
          variant="default"
          size="sm"
          iconName="Plus"
          iconSize={16}
          onClick={onAdd}
        >
          Add New
        </Button>
      </div>
      {data?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Icon name="Inbox" size={40} color="var(--color-muted-foreground)" />
          <p className="mt-3 text-sm">No records found. Click "Add New" to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {columns?.map((col) => (
                  <th
                    key={col?.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    style={{ width: col?.width }}
                  >
                    {col?.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.map((row) => (
                <tr key={row?.id} className="hover:bg-muted/30 transition-colors">
                  {columns?.map((col) => (
                    <td key={col?.key} className="px-4 py-3 text-foreground">
                      {col?.render ? col?.render(row?.[col?.key], row) : (
                        <span className="truncate block max-w-xs">{row?.[col?.key] ?? '—'}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {showActiveToggle && (
                        <button
                          onClick={() => onToggleActive?.(row?.id, !row?.is_active)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                            row?.is_active ? 'bg-success' : 'bg-muted-foreground/30'
                          }`}
                          title={row?.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              row?.is_active ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}
                      <Button
                        variant="ghost"
                        size="xs"
                        iconName="Pencil"
                        iconSize={14}
                        onClick={() => onEdit?.(row)}
                        title="Edit"
                      />
                      <Button
                        variant="ghost"
                        size="xs"
                        iconName="Trash2"
                        iconSize={14}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete?.(row)}
                        title="Delete"
                      />
                      {typeof extraRowActions === 'function' ? extraRowActions(row) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ManagementTable;
