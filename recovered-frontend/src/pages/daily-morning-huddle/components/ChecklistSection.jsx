import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import ConvertToTaskModal from './ConvertToTaskModal';

const ChecklistSection = ({ title, icon, items, onToggle, onNotesChange, isLocked, huddleId, officeId, officeName, userId }) => {
  const completedCount = items?.filter(i => i?.completed)?.length || 0;
  const totalCount = items?.length || 0;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const [convertItem, setConvertItem] = useState(null);
  const [taskCreatedIds, setTaskCreatedIds] = useState(new Set());

  const handleTaskCreated = (data) => {
    if (data?.checklist_item_id) {
      setTaskCreatedIds(prev => new Set([...prev, data?.checklist_item_id]));
    }
  };

  // Build placeholderMeta for items that don't have a DB row yet (id === null)
  const getPlaceholderMeta = (item) => {
    if (item?.id) return null;
    return {
      huddle_id: item?.huddle_id,
      section: item?.section,
      item_number: item?.item_number,
      item_text: item?.item_text,
      completed: item?.completed,
      notes: item?.notes,
    };
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h4 className="font-semibold text-sm text-foreground">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct === 100 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{completedCount}/{totalCount}</span>
        </div>
      </div>
      {/* Always expanded — no collapse behavior */}
      <div className="divide-y divide-border">
        {items?.map((item, idx) => {
          const placeholderMeta = getPlaceholderMeta(item);
          return (
            <div key={item?.id || `placeholder-${item?.section}-${item?.item_number || idx}`} className="p-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => !isLocked && onToggle?.(item?.id, !item?.completed, placeholderMeta)}
                  disabled={isLocked}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    item?.completed
                      ? 'bg-success border-success text-white' : 'border-border bg-background hover:border-primary'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                  aria-label={item?.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {item?.completed && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${
                    item?.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}>
                    <span className="font-medium text-muted-foreground mr-1">{idx + 1}.</span>
                    {item?.item_text}
                  </p>
                  <div className="mt-1.5 relative">
                    <textarea
                      value={item?.notes || ''}
                      onChange={(e) => !isLocked && onNotesChange?.(item?.id, e?.target?.value, placeholderMeta)}
                      disabled={isLocked}
                      placeholder="Notes / Action..."
                      rows={1}
                      className="w-full px-2 py-1.5 pr-24 text-xs border border-border rounded bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {/* Convert to Task button — only for persisted items (not placeholders) */}
                    {!isLocked && huddleId && item?.id && (
                      <button
                        type="button"
                        onClick={() => setConvertItem(item)}
                        title="Convert to Task"
                        className={`absolute right-1.5 top-1 flex items-center gap-1 px-2 py-0.5 text-xs rounded font-medium transition-smooth ${
                          taskCreatedIds?.has(item?.id)
                            ? 'bg-success/10 text-success border border-success/20' :'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                        }`}
                      >
                        {taskCreatedIds?.has(item?.id) ? (
                          <><Icon name="CheckCircle2" size={10} /> Task Created</>
                        ) : (
                          <><Icon name="Plus" size={10} /> Task</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Convert to Task Modal */}
      {convertItem && (
        <ConvertToTaskModal
          item={convertItem}
          huddleId={huddleId}
          officeId={officeId}
          officeName={officeName}
          createdBy={userId}
          onClose={() => setConvertItem(null)}
          onSuccess={handleTaskCreated}
        />
      )}
    </div>
  );
};

export default ChecklistSection;
