/** Skeleton shown while a page's data loads. Pure CSS, no client code. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl" role="status" aria-label="Loading">
      <div className="skeleton mb-2 h-8 w-48 rounded-lg" />
      <div className="skeleton mb-8 h-4 w-72 rounded-lg" />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
      </div>
      <div className="space-y-3">
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
      </div>
    </div>
  );
}
