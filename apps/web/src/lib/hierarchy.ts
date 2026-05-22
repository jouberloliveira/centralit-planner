import type { WorkItemKind } from '@centralit/shared';

export const VALID_PARENT_KINDS: Record<WorkItemKind, readonly WorkItemKind[]> = {
  epic: [],
  feature: ['epic'],
  story: ['feature', 'epic'],
  task: ['story', 'feature', 'epic'],
};

export function canHaveParent(kind: WorkItemKind, parentKind: WorkItemKind | null): boolean {
  if (parentKind === null) return true;
  return VALID_PARENT_KINDS[kind].includes(parentKind);
}

export const KIND_ORDER: WorkItemKind[] = ['epic', 'feature', 'story', 'task'];

export const KIND_BADGE_CLASS: Record<WorkItemKind, string> = {
  epic: 'border-l-type-epic',
  feature: 'border-l-type-feature',
  story: 'border-l-type-story',
  task: 'border-l-type-task',
};
