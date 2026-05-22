import { describe, expect, it } from 'vitest';
import { assertParentAllowed, WorkItemParentRuleError } from '../src/db/workItems.js';

describe('assertParentAllowed', () => {
  it('accepts EPIC with no parent', () => {
    expect(() => assertParentAllowed('EPIC', null)).not.toThrow();
  });

  it('rejects EPIC with any parent', () => {
    for (const parent of ['EPIC', 'FEATURE', 'USER_STORY', 'TASK'] as const) {
      expect(() => assertParentAllowed('EPIC', parent)).toThrow(WorkItemParentRuleError);
    }
  });

  it('accepts FEATURE with EPIC parent or null', () => {
    expect(() => assertParentAllowed('FEATURE', 'EPIC')).not.toThrow();
    expect(() => assertParentAllowed('FEATURE', null)).not.toThrow();
  });

  it('rejects FEATURE with non-EPIC parent', () => {
    for (const parent of ['FEATURE', 'USER_STORY', 'TASK'] as const) {
      expect(() => assertParentAllowed('FEATURE', parent)).toThrow(WorkItemParentRuleError);
    }
  });

  it('accepts USER_STORY under FEATURE or EPIC or null', () => {
    expect(() => assertParentAllowed('USER_STORY', 'FEATURE')).not.toThrow();
    expect(() => assertParentAllowed('USER_STORY', 'EPIC')).not.toThrow();
    expect(() => assertParentAllowed('USER_STORY', null)).not.toThrow();
  });

  it('rejects USER_STORY under USER_STORY or TASK', () => {
    for (const parent of ['USER_STORY', 'TASK'] as const) {
      expect(() => assertParentAllowed('USER_STORY', parent)).toThrow(WorkItemParentRuleError);
    }
  });

  it('accepts TASK under USER_STORY, FEATURE, EPIC, or null', () => {
    for (const parent of ['USER_STORY', 'FEATURE', 'EPIC'] as const) {
      expect(() => assertParentAllowed('TASK', parent)).not.toThrow();
    }
    expect(() => assertParentAllowed('TASK', null)).not.toThrow();
  });

  it('rejects TASK under TASK', () => {
    expect(() => assertParentAllowed('TASK', 'TASK')).toThrow(WorkItemParentRuleError);
  });
});
