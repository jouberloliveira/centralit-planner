import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-fg-secondary">The page you’re looking for doesn’t exist.</p>
      <Button asChild>
        <Link to="/">Back to projects</Link>
      </Button>
    </div>
  );
}
