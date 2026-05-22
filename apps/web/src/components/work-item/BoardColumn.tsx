import * as React from 'react';
import { useDrop } from 'react-dnd';
import type { WorkItem, WorkItemStatus } from '@centralit/shared';
import { cn } from '../../lib/cn';
import { WorkItemCard } from './WorkItemCard';
import { DND_WORK_ITEM, type DragWorkItem } from './dnd';

interface BoardColumnProps {
  status: WorkItemStatus;
  label: string;
  items: WorkItem[];
  onOpen: (item: WorkItem) => void;
  onDropItem: (id: string, status: WorkItemStatus) => void;
  onInlineCreate: (status: WorkItemStatus, title: string) => Promise<void> | void;
}

export function BoardColumn({
  status,
  label,
  items,
  onOpen,
  onDropItem,
  onInlineCreate,
}: BoardColumnProps) {
  const [creating, setCreating] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [{ isOver }, dropRef] = useDrop<DragWorkItem, void, { isOver: boolean }>(
    () => ({
      accept: DND_WORK_ITEM,
      drop: (item) => {
        if (item.status !== status) onDropItem(item.id, status);
      },
      collect: (m) => ({ isOver: m.isOver({ shallow: true }) }),
    }),
    [status, onDropItem],
  );

  React.useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const submitInline = async () => {
    const t = title.trim();
    if (!t) {
      setCreating(false);
      setTitle('');
      return;
    }
    await onInlineCreate(status, t);
    setTitle('');
    setCreating(false);
  };

  return (
    <div
      ref={dropRef as unknown as React.Ref<HTMLDivElement>}
      data-testid={`column-${status}`}
      className={cn(
        'flex w-[320px] shrink-0 flex-col gap-3 rounded-lg bg-surface-column p-3 transition-colors',
        isOver && 'ring-2 ring-border-focus',
      )}
    >
      <header className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
        <span className="text-xs text-fg-tertiary">{items.length}</span>
      </header>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <WorkItemCard key={it.id} item={it} onOpen={onOpen} />
        ))}
        {creating ? (
          <input
            ref={inputRef}
            data-testid={`inline-create-${status}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submitInline}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submitInline();
              } else if (e.key === 'Escape') {
                setCreating(false);
                setTitle('');
              }
            }}
            placeholder="Title and press Enter"
            className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
          />
        ) : (
          <button
            type="button"
            data-testid={`inline-create-trigger-${status}`}
            onClick={() => setCreating(true)}
            className="rounded-md border border-dashed border-border px-3 py-2 text-left text-xs text-fg-tertiary hover:bg-neutral-100"
          >
            + New item
          </button>
        )}
      </div>
    </div>
  );
}
