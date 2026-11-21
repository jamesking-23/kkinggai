export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 pt-24 text-center">
      <p className="text-5xl font-light tracking-tight text-muted">404</p>
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That page does not exist or has moved.</p>
      <a
        href="/"
        className="btn-primary mt-6 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
      >
        Back to the dashboard
      </a>
    </main>
  );
}
