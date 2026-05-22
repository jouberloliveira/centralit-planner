import * as React from 'react';
import { useDrop } from 'react-dnd';
import { useParams } from 'react-router-dom';
import type { WorkItem } from '@centralit/shared';
import { AxiosError } from 'axios';
import { Button } from '../components/ui/button';
import { ItemDrawer } from '../components/work-item/ItemDrawer';
import { TreeNode, type TreeNodeData } from '../components/work-item/TreeNode';
import {
  useMoveWorkItem,
  useWorkItems,
} from '../lib/queries/workItems';
import { DND_WORK_ITEM, type DragWorkItem } from '../components/work-item/dnd';
import { canHaveParent } from '../lib/hierarchy';
import { cn } from '../lib/cn';

function buildTree(items: WorkItem[]): TreeNodeData[] {
  const byId = new Map<string, TreeNodeData>();
  for (const it of items) byId.set(it.id, { item: it, children: [] });
  const roots: TreeNodeData[] = [];
  for (const node of byId.values()) {
    const pid = node.item.parentId;
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const orderKind = { epic: 0, feature: 1, story: 2, task: 3 };
  const sortRec = (nodes: TreeNodeData[]) => {
    nodes.sort(
      (a, b) =>
        orderKind[a.item.kind] - orderKind[b.item.kind] ||
        a.item.title.localeCompare(b.item.title),
    );
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

interface DrawerState {
  open: boolean;
  variant:
    | { mode: 'create' }
    | { mode: 'edit'; workItem: WorkItem };
}

function apiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Move failed';
}

export function TreePage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data, isLoading, error } = useWorkItems({ projectId, limit: 200 });
  const moveMut = useMoveWorkItem();
  const [drawer, setDrawer] = React.useState<DrawerState>({
    open: false,
    variant: { mode: 'create' },
  });

  const tree = React.useMemo(() => buildTree(data?.items ?? []), [data]);

  const handleReparent = React.useCallback(
    async (id: string, parentId: string | null) => {
      try {
        await moveMut.mutateAsync({ id, parentId });
      } catch (err) {
        window.alert(`Reparent failed: ${apiErrorMessage(err)}`);
      }
    },
    [moveMut],
  );

  const [{ isOver, canDrop }, rootDropRef] = useDrop<
    DragWorkItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >(
    () => ({
      accept: DND_WORK_ITEM,
      canDrop: (dragged) => canHaveParent(dragged.kind, null),
      drop: (dragged, monitor) => {
        if (monitor.didDrop()) return;
        if (dragged.parentId === null) return;
        handleReparent(dragged.id, null);
      },
      collect: (m) => ({
        isOver: m.isOver({ shallow: true }),
        canDrop: m.canDrop(),
      }),
    }),
    [handleReparent],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-secondary">
          Drag items to reparent. Epic → Feature → Story → Task.
        </p>
        <Button
          data-testid="tree-new-item"
          onClick={() => setDrawer({ open: true, variant: { mode: 'create' } })}
        >
          New item
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger-500">
          Failed to load tree.
        </p>
      )}

      <div
        ref={rootDropRef as unknown as React.Ref<HTMLDivElement>}
        data-testid="tree-root"
        className={cn(
          'flex min-h-[200px] flex-col gap-1 rounded-md border border-dashed border-border p-3',
          isOver && canDrop && 'border-success-500 bg-success-50/30',
        )}
      >
        {isLoading && <p className="text-sm text-fg-tertiary">Loading…</p>}
        {!isLoading && tree.length === 0 && (
          <p className="text-sm text-fg-tertiary">No items yet. Create an Epic to start.</p>
        )}
        {tree.map((n) => (
          <TreeNode
            key={n.item.id}
            node={n}
            depth={0}
            onOpen={(item) => setDrawer({ open: true, variant: { mode: 'edit', workItem: item } })}
            onReparent={handleReparent}
          />
        ))}
      </div>

      {drawer.open && (
        <ItemDrawer
          open={drawer.open}
          onOpenChange={(open) => setDrawer((s) => ({ ...s, open }))}
          projectId={projectId}
          variant={drawer.variant}
        />
      )}
    </div>
  );
}
