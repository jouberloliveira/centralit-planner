import * as React from 'react';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '../components/ui/drawer';
import { useCreateProject, useProjects } from '../lib/queries/projects';

export function ProjectsPage() {
  const { data, isLoading, error } = useProjects();
  const createMut = useCreateProject();
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await createMut.mutateAsync({
        key: key.trim().toUpperCase(),
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setKey('');
      setName('');
      setDescription('');
      setOpen(false);
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? ((err.response?.data as { error?: { message?: string } })?.error?.message ?? err.message)
          : err instanceof Error
            ? err.message
            : 'Failed';
      setFormError(msg);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <Button data-testid="new-project" onClick={() => setOpen(true)}>
          New project
        </Button>
      </header>

      {error && (
        <p role="alert" className="text-sm text-danger-500">
          Failed to load projects.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-fg-tertiary">Loading…</p>}
        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
              <CardDescription>Create one to get started.</CardDescription>
            </CardHeader>
          </Card>
        )}
        {data?.items.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            data-testid="project-card"
            className="block focus:outline-none"
          >
            <Card className="h-full cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  <span className="rounded-pill bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {p.key}
                  </span>
                </div>
                <CardDescription>{p.description ?? '—'}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-fg-secondary">Open board →</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="flex flex-col" data-testid="project-drawer">
          <DrawerHeader>
            <DrawerTitle>New project</DrawerTitle>
            <DrawerDescription>
              Pick a short uppercase key (e.g. CEN) and a name.
            </DrawerDescription>
          </DrawerHeader>
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pj-key">Key</Label>
              <Input
                id="pj-key"
                data-testid="pj-key"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                pattern="[A-Z][A-Z0-9]+"
                minLength={2}
                maxLength={10}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pj-name">Name</Label>
              <Input
                id="pj-name"
                data-testid="pj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pj-desc">Description</Label>
              <textarea
                id="pj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                className="flex w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm"
              />
            </div>
            {formError && (
              <p role="alert" className="text-sm text-danger-500">
                {formError}
              </p>
            )}
            <div className="mt-auto flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={createMut.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" data-testid="pj-submit" disabled={createMut.isPending}>
                Create
              </Button>
            </div>
          </form>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
