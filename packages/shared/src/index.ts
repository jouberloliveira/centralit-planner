export type IssueKind = 'epic' | 'feature' | 'story' | 'task';

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';

export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface IssueBase {
  id: string;
  kind: IssueKind;
  title: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}
