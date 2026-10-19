import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container page center">
      <h1 className="h1">Page not found</h1>
      <p className="lead">This page doesn’t exist, or the tool isn’t available yet.</p>
      <div className="actions centered">
        <Link href="/tools" className="btn btn-primary">
          Browse tools
        </Link>
        <Link href="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </div>
  );
}
