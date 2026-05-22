import * as React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { WorkItem } from '@centralit/shared';
import { cn } from '../../lib/cn';
import { KIND_BADGE_CLASS, canHaveParent } from '../../lib/hierarchy';
import { KIND_LABEL } from '../../lib/queries/workItems';
import { DND_WORK_ITEM, type DragWorkItem } from './dnd';

export interface TreeNodeData {
  item: WorkItem;
  children: TreeNodeData[];
}

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  onOpen: (item: WorkItem) => void;
  onReparent: (id: string, parentId: string | null) => void;
}

export function TreeNode({ node, depth, onOpen, onReparent }: TreeNodeProps) {
  const [expanded, setExpanded] = React.useState(true);
  const hasChildren = node.children.length > 0;

  const [{ isDragging }, dragRef] = useDrag<DragWorkItem, void, { isDragging: boolean }>(
    () => ({
      type: DND_WORK_ITEM,
      item: {
        id: node.item.id,
        kind: node.item.kind,
        status: node.item.status,
        parentId: node.item.parentId ?? null,
      },
      collect: (m) => ({ isDragging: m.isDragging() }),
    }),
    [node.item.id, node.item.kind, node.item.status, node.item.parentId],
  );

  const [{ isOver, canDrop }, dropRef] = useDrop<
    DragWorkItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >(
    () => ({
      accept: DND_WORK_ITEM,
      canDrop: (dragged) => {
        if (dragged.id === node.item.id) return false;
        if (isDescendant(node, dragged.id)) return false;
        return canHaveParent(dragged.kind, node.item.kind);
      },
      drop: (dragged, monitor) => {
        if (monitor.didDrop()) return;
        onReparent(dragged.id, node.item.id);
      },
      collect: (m) => ({
        isOver: m.isOver({ shallow: true }),
        canDrop: m.canDrop(),
      }),
    }),
    [node, onReparent],
  );

  const setRefs = (el: HTMLDivElement | null) => {
    dragRef(el);
    dropRef(el);
  };

  return (
    <div
      data-testid={`tree-node-${node.item.id}`}
      data-id={node.item.id}
      data-kind={node.item.kind}
      className={cn('flex flex-col', isDragging && 'opacity-50')}
    >
      <div
        ref={setRefs}
        className={cn(
          'flex items-center gap-2 rounded-md border-l-[3px] bg-surface-raised px-2 py-1.5 hover:bg-neutral-50',
          KIND_BADGE_CLASS[node.item.kind],
          isOver && canDrop && 'ring-2 ring-success-500',
          isOver && !canDrop && 'ring-2 ring-danger-500',
        )}
        style={{ marginLeft: depth * 20 }}
      >
        <button
          type="button"
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="flex h-5 w-5 items-center justify-center text-fg-tertiary"
          onClick={() => setExpanded((v) => !v)}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="h-1 w-1 rounded-full bg-neutral-300" />
          )}
        </button>
        <span className="rounded-pill bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-fg-secondary">
          {KIND_LABEL[node.item.kind]}
        </span>
        <button
          type="button"
          className="flex-1 truncate text-left text-sm hover:underline"
          onClick={() => onOpen(node.item)}
        >
          {node.item.title}
        </button>
        <span className="text-xs text-fg-tertiary">{node.item.status}</span>
      </div>
      {expanded && hasChildren && (
        <div className="mt-1 flex flex-col gap-1">
          {node.children.map((c) => (
            <TreeNode
              key={c.item.id}
              node={c}
              depth={depth + 1}
              onOpen={onOpen}
              onReparent={onReparent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function isDescendant(node: TreeNodeData, candidateId: string): boolean {
  if (node.item.id === candidateId) return true;
  return node.children.some((c) => isDescendant(c, candidateId));
}
