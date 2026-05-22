import { Link, NavLink, Outlet } from 'react-router-dom';
import { LogOut, Folder, Star, Users, Settings } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../lib/cn';
import { Button } from '../components/ui/button';

const sidebarLinks = [
  { to: '/', label: 'Projects', icon: Folder },
  { to: '/starred', label: 'Starred', icon: Star },
  { to: '/people', label: 'People', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div className="grid h-full grid-rows-[56px_1fr] bg-surface text-fg">
      <header className="flex items-center justify-between border-b border-border bg-surface-raised px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-base font-semibold tracking-tight">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-brand-600 text-fg-onBrand text-xs mr-2">
              P
            </span>
            Planner
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-fg-secondary md:inline">{user?.email}</span>
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-neutral-200 text-xs font-semibold text-fg"
            aria-label="user avatar"
          >
            {initials}
          </span>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="grid grid-cols-[240px_1fr] overflow-hidden">
        <aside className="border-r border-border bg-neutral-50">
          <nav className="flex flex-col gap-1 p-3">
            {sidebarLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-neutral-100',
                    isActive && 'bg-neutral-100 text-fg font-medium',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
