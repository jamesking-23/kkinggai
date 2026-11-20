import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import {
  cleanQuery,
  groupHits,
  highlight,
  intersectHits,
  splitTerms,
  type SearchHit,
} from "../../../lib/search";
import { Card, Empty, inputClass, PageHeader, primaryButton } from "../../../components/ui";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getAppContext();
  const { q: raw } = await searchParams;
  const q = cleanQuery(raw);

  const terms = q ? splitTerms(q) : [];
  let groups: ReturnType<typeof groupHits> = [];
  let failed = false;
  if (q) {
    const supabase = await createClient();
    // Each word is searched on its own and only items matching every word are kept, so the words can be
    // in different fields ("title" and "description") and in any order.
    const many = terms.length > 1;
    const lists = await Promise.all(
      (many ? terms : [q]).map((term) =>
        supabase.rpc("search_workspace", { ws: ctx.current.id, q: term, per_kind: many ? 20 : 8 }),
      ),
    );
    if (lists.some((l) => l.error)) failed = true;
    else {
      const hits = intersectHits(lists.map((l) => (l.data ?? []) as SearchHit[]));
      groups = groupHits(hits, ctx.enabledModules);
    }
  }
  const marks = terms.length > 0 ? terms : q ? [q] : [];

  const Marked = ({ text }: { text: string }) => (
    <>
      {highlight(text, marks).map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded bg-primary/25 px-0.5 text-text">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Search"
        subtitle={`Searches ${ctx.current.name} and your private vault and chats. Several words must all match; put a phrase in "quotes". Only enabled modules are included.`}
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
                    <Marked text={h.title} />
                  </a>
                  {h.snippet && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      <Marked text={h.snippet} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
