import * as React from 'react';
import type {
  WorkItem,
  WorkItemCreate,
  WorkItemKind,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemUpdate,
} from '@centralit/shared';
import { AxiosError } from 'axios';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '../ui/drawer';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  useCreateWorkItem,
  useDeleteWorkItem,
  useMoveWorkItem,
  useUpdateWorkItem,
  useWorkItems,
  KIND_LABEL,
} from '../../lib/queries/workItems';
import { canHaveParent, VALID_PARENT_KINDS } from '../../lib/hierarchy';

const KINDS: WorkItemKind[] = ['epic', 'feature', 'story', 'task'];
const STATUSES: WorkItemStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled',
];
const PRIORITIES: WorkItemPriority[] = ['critical', 'high', 'medium', 'low'];

const STATUS_LABEL: Record<WorkItemStatus, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

const PRIORITY_LABEL: Record<WorkItemPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

type DrawerVariant =
  | { mode: 'create'; initial?: Partial<WorkItemCreate> }
  | { mode: 'edit'; workItem: WorkItem };

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  variant: DrawerVariant;
}

function apiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export function ItemDrawer({ open, onOpenChange, projectId, variant }: ItemDrawerProps) {
  const isCreate = variant.mode === 'create';
  const initialKind = isCreate ? variant.initial?.kind ?? 'task' : variant.workItem.kind;
  const initialParentId = isCreate
    ? variant.initial?.parentId ?? null
    : variant.workItem.parentId ?? null;

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [kind, setKind] = React.useState<WorkItemKind>(initialKind);
  const [status, setStatus] = React.useState<WorkItemStatus>('backlog');
  const [priority, setPriority] = React.useState<WorkItemPriority>('medium');
  const [assigneeId, setAssigneeId] = React.useState('');
  const [parentId, setParentId] = React.useState<string | null>(initialParentId);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (variant.mode === 'create') {
      setTitle('');
      setDescription('');
      setKind(variant.initial?.kind ?? 'task');
      setStatus(variant.initial?.status ?? 'backlog');
      setPriority(variant.initial?.priority ?? 'medium');
      setAssigneeId(variant.initial?.assigneeId ?? '');
      setParentId(variant.initial?.parentId ?? null);
    } else {
      const it = variant.workItem;
      setTitle(it.title);
      setDescription(it.description ?? '');
      setKind(it.kind);
      setStatus(it.status);
      setPriority(it.priority);
      setAssigneeId(it.assigneeId ?? '');
      setParentId(it.parentId ?? null);
    }
    setError(null);
  }, [open, variant]);

  const allowedParentKinds = VALID_PARENT_KINDS[kind];
  const candidateParentsQuery = useWorkItems({ projectId, limit: 200 });
  const candidateParents = (candidateParentsQuery.data?.items ?? []).filter(
    (it) =>
      allowedParentKinds.includes(it.kind) &&
      (variant.mode !== 'edit' || it.id !== variant.workItem.id),
  );

  const createMut = useCreateWorkItem(projectId);
  const updateMut = useUpdateWorkItem();
  const moveMut = useMoveWorkItem();
  const deleteMut = useDeleteWorkItem();

  const findKind = (id: string): WorkItemKind | null => {
    return candidateParentsQuery.data?.items.find((it) => it.id === id)?.kind ?? null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!canHaveParent(kind, parentId ? findKind(parentId) : null)) {
      setError(`${KIND_LABEL[kind]} cannot have that parent`);
      return;
    }
    try {
      if (variant.mode === 'create') {
        const payload: WorkItemCreate = {
          kind,
          title: title.trim(),
          projectId,
          status,
          priority,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(parentId ? { parentId } : {}),
          ...(assigneeId.trim() ? { assigneeId: assigneeId.trim() } : {}),
        };
        await createMut.mutateAsync(payload);
      } else {
        const it = variant.workItem;
        const patch: WorkItemUpdate = {};
        if (title.trim() !== it.title) patch.title = title.trim();
        const desc = description.trim() === '' ? null : description.trim();
        if (desc !== (it.description ?? null)) patch.description = desc;
        if (status !== it.status) patch.status = status;
        if (priority !== it.priority) patch.priority = priority;
        const ass = assigneeId.trim() === '' ? null : assigneeId.trim();
        if (ass !== (it.assigneeId ?? null)) patch.assigneeId = ass;
        if (Object.keys(patch).length > 0) {
          await updateMut.mutateAsync({ id: it.id, patch });
        }
        if ((parentId ?? null) !== (it.parentId ?? null)) {
          await moveMut.mutateAsync({ id: it.id, parentId: parentId ?? null });
        }
      }
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (variant.mode !== 'edit') return;
    if (!window.confirm(`Delete "${variant.workItem.title}"?`)) return;
    setError(null);
    try {
      await deleteMut.mutateAsync(variant.workItem.id);
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const submitting =
    createMut.isPending || updateMut.isPending || moveMut.isPending || deleteMut.isPending;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        data-testid="item-drawer"
        aria-label="Work item drawer"
        className="flex flex-col"
      >
        <DrawerHeader>
          <DrawerTitle>
            {isCreate ? 'New work item' : variant.workItem.title}
          </DrawerTitle>
          <DrawerDescription>
            {isCreate
              ? 'Create an Epic, Feature, Story, or Task in this project.'
              : `${KIND_LABEL[variant.workItem.kind]} · ${variant.workItem.id.slice(0, 8)}`}
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wi-title">Title</Label>
            <Input
              id="wi-title"
              data-testid="wi-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
              maxLength={300}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wi-description">Description</Label>
            <textarea
              id="wi-description"
              data-testid="wi-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={10000}
              rows={5}
              className="flex w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-fg placeholder:text-fg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wi-kind">Type</Label>
              {isCreate ? (
                <Select value={kind} onValueChange={(v) => setKind(v as WorkItemKind)}>
                  <SelectTrigger id="wi-kind" data-testid="wi-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={KIND_LABEL[kind]} readOnly disabled />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wi-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as WorkItemStatus)}>
                <SelectTrigger id="wi-status" data-testid="wi-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wi-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as WorkItemPriority)}>
                <SelectTrigger id="wi-priority" data-testid="wi-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wi-assignee">Assignee (UUID)</Label>
              <Input
                id="wi-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                placeholder="Optional user UUID"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wi-parent">Parent</Label>
            <Select
              value={parentId ?? '__none__'}
              onValueChange={(v) => setParentId(v === '__none__' ? null : v)}
            >
              <SelectTrigger id="wi-parent" data-testid="wi-parent">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {candidateParents.map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    [{KIND_LABEL[it.kind]}] {it.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allowedParentKinds.length === 0 && (
              <p className="text-xs text-fg-tertiary">Epics have no parent.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger-500">
              {error}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            {!isCreate && (
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={submitting}
              >
                Delete
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="wi-submit" disabled={submitting}>
                {isCreate ? 'Create' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
