import { getAppContext } from "../../lib/session";

export default async function DashboardPage() {
  const ctx = await getAppContext();
  const today = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeZone: ctx.timezone,
  }).format(new Date());

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-muted">{today}</p>
      <h1 className="mt-1 text-2xl font-semibold">Welcome, {ctx.displayName}</h1>
      <p className="mt-1 text-sm text-muted">Workspace: {ctx.current.name}</p>

      <section className="mt-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-medium">Nothing here yet</h2>
        <p className="mt-1 text-sm text-muted">
          Tasks, projects, goals and your calendar arrive in the next phase. This dashboard only
          shows real data, so it stays empty until those modules exist.
        </p>
      </section>
    </div>
  );
}
