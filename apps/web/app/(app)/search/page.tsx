import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { cleanQuery, groupHits, type SearchHit } from "../../../lib/search";
import { Card, Empty, inputClass, PageHeader, primaryButton } from "../../../components/ui";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getAppContext();
  const { q: raw } = await searchParams;
  const q = cleanQuery(raw);

  let groups: ReturnType<typeof groupHits> = [];
  let failed = false;
  if (q) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_workspace", { ws: ctx.current.id, q });
    if (error) failed = true;
    else groups = groupHits((data ?? []) as SearchHit[], ctx.enabledModules);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Search"
        subtitle={`Searches ${ctx.current.name} and your private vault and chats. Only enabled modules are included.`}
      />
      <form action="/search" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={raw ?? ""}
          minLength={2}
          maxLength={100}
          placeholder="Search tasks, goals, notes…"
          aria-label="Search"
          className={inputClass}
        />
        <button type="submit" className={primaryButton}>
          Search
        </button>
      </form>

      {!q && <Empty>Type at least 2 characters.</Empty>}
      {failed && (
        <p role="alert" className="text-sm text-danger">
          Search failed. Try again.
        </p>
      )}
      {q && !failed && groups.length === 0 && <Empty>No results for “{q}”.</Empty>}

      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g.kind} title={g.label}>
            <ul className="space-y-3">
              {g.hits.map((h) => (
                <li key={h.id}>
                  <a href={h.href} className="text-sm font-medium text-primary hover:underline">
                    {h.title}
                  </a>
                  {h.snippet && <p className="mt-0.5 truncate text-xs text-muted">{h.snippet}</p>}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
