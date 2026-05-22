import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export function ProjectsPage() {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-fg-secondary">Pick a project to open its board.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/projects/sample" className="block focus:outline-none">
          <Card className="h-full cursor-pointer">
            <CardHeader>
              <CardTitle>Sample Project</CardTitle>
              <CardDescription>Placeholder — real list lands once the API ships.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-fg-secondary">Open board →</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </section>
  );
}
