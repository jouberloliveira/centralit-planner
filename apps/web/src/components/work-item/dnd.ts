import type { WorkItemKind, WorkItemStatus } from '@centralit/shared';

export const DND_WORK_ITEM = 'work-item';

export interface DragWorkItem {
  id: string;
  kind: WorkItemKind;
  status: WorkItemStatus;
  parentId: string | null;
}
