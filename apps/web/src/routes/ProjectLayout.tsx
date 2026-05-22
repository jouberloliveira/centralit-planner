import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useProject } from '../lib/queries/projects';
import { cn } from '../lib/cn';

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useProject(projectId);
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'px-3 py-2 text-sm text-fg-secondary border-b-2 border-transparent transition-colors',
      isActive && 'text-fg font-medium border-brand-600',
    );

  return (
    <section className="flex h-full flex-col gap-4">
      <header className="flex flex-col gap-2">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-xs text-fg-tertiary"
          data-testid="breadcrumbs"
        >
          <Link to="/" className="hover:text-fg-secondary">
            Projects
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-fg-secondary">
            {isLoading ? '…' : project?.key ?? projectId}
          </span>
        </nav>
        <h1 className="text-xl font-semibold tracking-tight">
          {project?.name ?? (isLoading ? 'Loading…' : projectId)}
        </h1>
      </header>
      <nav className="flex gap-1 border-b border-border">
        <NavLink to="." end className={tabClass} data-testid="tab-board">
          Board
        </NavLink>
        <NavLink to="tree" className={tabClass} data-testid="tab-tree">
          Tree
        </NavLink>
      </nav>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </section>
  );
}
