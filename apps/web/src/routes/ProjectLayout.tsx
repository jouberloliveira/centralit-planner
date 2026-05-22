import { NavLink, Outlet, useParams } from 'react-router-dom';
import { cn } from '../lib/cn';

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'px-3 py-2 text-sm text-fg-secondary border-b-2 border-transparent transition-colors',
      isActive && 'text-fg font-medium border-brand-600',
    );

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wider text-fg-tertiary">Project</p>
        <h1 className="text-xl font-semibold tracking-tight">{projectId}</h1>
      </header>
      <nav className="flex gap-1 border-b border-border">
        <NavLink to="." end className={tabClass}>
          Board
        </NavLink>
        <NavLink to="tree" className={tabClass}>
          Tree
        </NavLink>
      </nav>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </section>
  );
}
