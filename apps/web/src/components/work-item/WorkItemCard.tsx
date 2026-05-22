import * as React from 'react';
import { useDrag } from 'react-dnd';
import type { WorkItem } from '@centralit/shared';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/cn';
import { KIND_BADGE_CLASS } from '../../lib/hierarchy';
import { KIND_LABEL } from '../../lib/queries/workItems';
import { DND_WORK_ITEM, type DragWorkItem } from './dnd';

interface WorkItemCardProps {
  item: WorkItem;
  onOpen: (item: WorkItem) => void;
}

export function WorkItemCard({ item, onOpen }: WorkItemCardProps) {
  const [{ isDragging }, dragRef] = useDrag<DragWorkItem, void, { isDragging: boolean }>(
    () => ({
      type: DND_WORK_ITEM,
      item: {
        id: item.id,
        kind: item.kind,
        status: item.status,
        parentId: item.parentId ?? null,
      },
      collect: (m) => ({ isDragging: m.isDragging() }),
    }),
    [item.id, item.kind, item.status, item.parentId],
  );

  return (
    <div ref={dragRef as unknown as React.Ref<HTMLDivElement>}>
      <Card
        data-testid="work-item-card"
        data-id={item.id}
        data-kind={item.kind}
        onClick={() => onOpen(item)}
        className={cn(
          'cursor-pointer border-l-[3px]',
          KIND_BADGE_CLASS[item.kind],
          isDragging && 'opacity-50',
        )}
      >
        <CardHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-fg-tertiary">
            <span>{KIND_LABEL[item.kind]}</span>
            <span>·</span>
            <span>{item.priority}</span>
          </div>
          <CardTitle className="text-sm">{item.title}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
