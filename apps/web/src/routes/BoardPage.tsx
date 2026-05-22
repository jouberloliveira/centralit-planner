import type { IssueStatus } from '@centralit/shared';
import { Card, CardHeader, CardTitle } from '../components/ui/card';

const columns: { id: IssueStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'in_review', label: 'In review' },
  { id: 'done', label: 'Done' },
];

export function BoardPage() {
  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div
          key={col.id}
          className="flex w-[320px] shrink-0 flex-col gap-3 rounded-lg bg-surface-column p-3"
        >
          <header className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold tracking-tight">{col.label}</h2>
            <span className="text-xs text-fg-tertiary">0</span>
          </header>
          <div className="flex flex-col gap-2">
            <Card className="border-l-[3px] border-l-type-task">
              <CardHeader>
                <CardTitle className="text-sm">Placeholder card</CardTitle>
                <p className="text-xs text-fg-secondary">Hierarchy UI lands in CEN-13.</p>
              </CardHeader>
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}
