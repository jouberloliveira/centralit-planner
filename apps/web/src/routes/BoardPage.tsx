import * as React from 'react';
import { useParams } from 'react-router-dom';
import type {
  WorkItem,
  WorkItemKind,
  WorkItemStatus,
} from '@centralit/shared';
import { AxiosError } from 'axios';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { BoardColumn } from '../components/work-item/BoardColumn';
import { ItemDrawer } from '../components/work-item/ItemDrawer';
import {
  KIND_LABEL,
  useCreateWorkItem,
  useUpdateWorkItem,
  useWorkItems,
} from '../lib/queries/workItems';

const columns: { id: WorkItemStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'in_review', label: 'In review' },
  { id: 'done', label: 'Done' },
];

const KIND_FILTERS: (WorkItemKind | 'all')[] = ['all', 'epic', 'feature', 'story', 'task'];

interface BoardDrawerState {
  open: boolean;
  variant:
    | { mode: 'create'; initial?: { status?: WorkItemStatus; kind?: WorkItemKind } }
    | { mode: 'edit'; workItem: WorkItem };
}

function apiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export function BoardPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [kindFilter, setKindFilter] = React.useState<WorkItemKind | 'all'>('all');
  const [drawer, setDrawer] = React.useState<BoardDrawerState>({
    open: false,
    variant: { mode: 'create' },
  });

  const { data, isLoading, error } = useWorkItems({
    projectId,
    ...(kindFilter !== 'all' ? { kind: kindFilter } : {}),
    limit: 200,
  });

  const createMut = useCreateWorkItem(projectId);
  const updateMut = useUpdateWorkItem();

  const byStatus = React.useMemo(() => {
    const map: Record<WorkItemStatus, WorkItem[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
      cancelled: [],
    };
    for (const it of data?.items ?? []) map[it.status].push(it);
    return map;
  }, [data]);

  const handleDropItem = (id: string, status: WorkItemStatus) => {
    updateMut.mutate({ id, patch: { status } });
  };

  const handleInlineCreate = async (status: WorkItemStatus, title: string) => {
    try {
      await createMut.mutateAsync({
        kind: kindFilter === 'all' ? 'task' : kindFilter,
        title,
        projectId,
        status,
      });
    } catch (err) {
      window.alert(`Create failed: ${apiErrorMessage(err)}`);
    }
  };

  const handleOpenItem = (item: WorkItem) => {
    setDrawer({ open: true, variant: { mode: 'edit', workItem: item } });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-fg-tertiary">Type</span>
          <Select
            value={kindFilter}
            onValueChange={(v) => setKindFilter(v as WorkItemKind | 'all')}
          >
            <SelectTrigger className="w-40" data-testid="board-kind-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_FILTERS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k === 'all' ? 'All types' : KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          data-testid="board-new-item"
          className="ml-auto"
          onClick={() =>
            setDrawer({
              open: true,
              variant: {
                mode: 'create',
                initial: { kind: kindFilter === 'all' ? 'task' : kindFilter },
              },
            })
          }
        >
          New item
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger-500">
          Failed to load work items.
        </p>
      )}

      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {isLoading
          ? columns.map((c) => (
              <div
                key={c.id}
                className="flex w-[320px] shrink-0 flex-col gap-3 rounded-lg bg-surface-column p-3"
              >
                <header className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold tracking-tight">{c.label}</h2>
                </header>
                <div className="h-10 animate-pulse rounded-md bg-neutral-100" />
              </div>
            ))
          : columns.map((c) => (
              <BoardColumn
                key={c.id}
                status={c.id}
                label={c.label}
                items={byStatus[c.id]}
                onOpen={handleOpenItem}
                onDropItem={handleDropItem}
                onInlineCreate={handleInlineCreate}
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
