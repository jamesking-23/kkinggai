import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import type { FlashParams } from "../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../components/ui";
import { addFeed, refreshAll, removeFeed, setItemState } from "./actions";

export const maxDuration = 30;

type Search = FlashParams & { view?: string; feed?: string };

export default async function NewsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "news");
  const { error, message, view, feed } = await searchParams;
  const supabase = await createClient();

  const { data: feeds } = await supabase
    .from("news_feeds")
    .select("id, url, title, topic, last_fetched_at, last_error, revision")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const feedList = feeds ?? [];
  const byId = new Map(feedList.map((f) => [f.id, f]));
  const ids = feedList.map((f) => f.id);
  const mode = view === "saved" ? "saved" : view === "unread" ? "unread" : "all";
  const only = feed && byId.has(feed) ? feed : null;

  let items: {
    id: string;
    feed_id: string;
    title: string;
    link: string | null;
    summary: string;
    published_at: string | null;
    read_at: string | null;
    saved: boolean;
  }[] = [];
  if (ids.length > 0) {
    let q = supabase
      .from("news_items")
      .select("id, feed_id, title, link, summary, published_at, read_at, saved")
      .in("feed_id", only ? [only] : ids)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (mode === "saved") q = q.eq("saved", true);
    if (mode === "unread") q = q.is("read_at", null);
    items = (await q).data ?? [];
  }

  const tab = (v: string, label: string) => (
    <a
      key={v}
      href={`/news?view=${v}${only ? `&feed=${only}` : ""}`}
      className={mode === v ? "font-medium text-primary" : "text-muted"}
    >
      {label}
    </a>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="News"
        subtitle="Feeds you choose, fetched on request. Private to you. Nothing is fetched in the background."
      />
      <Flash error={error} message={message} />

      <Card title="Feeds" className="mb-6">
        <form action={addFeed} className="mb-4 grid gap-3 sm:grid-cols-6">
          <input
            name="url"
            type="url"
            required
            maxLength={500}
            placeholder="https://example.com/feed.xml"
            aria-label="Feed address"
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="topic"
            maxLength={60}
            placeholder="Topic (optional)"
            aria-label="Topic"
            className={`${inputClass} sm:col-span-2`}
          />
          <button className={`${primaryButton} sm:col-span-1`}>Add</button>
        </form>
        {feedList.length === 0 ? (
          <p className="text-sm text-muted">
            No feeds yet. Paste the address of an RSS or Atom feed. Only public web addresses work.
          </p>
        ) : (
          <>
            <ul className="mb-3 divide-y divide-border text-sm">
              {feedList.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1">
                    <a href={`/news?feed=${f.id}`} className="font-medium text-primary">
                      {f.title || f.url}
                    </a>
                    {f.topic && <span className="ml-2 text-xs text-muted">{f.topic}</span>}
                    <span className="block text-xs text-muted">
                      {f.last_error ? (
                        <span className="text-danger">{f.last_error}</span>
                      ) : f.last_fetched_at ? (
                        `Updated ${f.last_fetched_at.slice(0, 16).replace("T", " ")} UTC`
                      ) : (
                        "Not fetched yet"
                      )}
                    </span>
                  </span>
                  <form action={removeFeed}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="revision" value={f.revision} />
                    <button className={subtleButton}>Remove</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={refreshAll}>
              <button className={subtleButton}>Refresh all feeds</button>
            </form>
          </>
        )}
      </Card>

      <Card title={only ? `Items from ${byId.get(only)?.title || "this feed"}` : "Items"}>
        <p className="mb-3 flex gap-4 text-sm">
          {tab("all", "All")}
          {tab("unread", "Unread")}
          {tab("saved", "Saved")}
          {only && (
            <a href={`/news?view=${mode}`} className="ml-auto text-muted">
              Show all feeds
            </a>
          )}
        </p>
        {items.length === 0 ? (
          <Empty>
            {feedList.length === 0
              ? "Add a feed to see items here."
              : mode === "all"
                ? "No items yet. Use Refresh all feeds."
                : "Nothing matches this view."}
          </Empty>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {items.map((i) => (
              <li key={i.id} className="py-3">
                <div className={i.read_at ? "text-muted" : ""}>
                  {i.link ? (
                    <a
                      href={i.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary"
                    >
                      {i.title}
                    </a>
                  ) : (
                    <span className="font-medium">{i.title}</span>
                  )}
                  <span className="ml-2 text-xs text-muted">
                    {byId.get(i.feed_id)?.title || ""}
                    {i.published_at ? ` · ${i.published_at.slice(0, 10)}` : ""}
                  </span>
                  {i.summary && <p className="mt-1">{i.summary}</p>}
                </div>
                <div className="mt-2 flex gap-2">
                  <form action={setItemState}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="read" value={i.read_at ? "0" : "1"} />
                    <button className={subtleButton}>
                      {i.read_at ? "Mark unread" : "Mark read"}
                    </button>
                  </form>
                  <form action={setItemState}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="saved" value={i.saved ? "0" : "1"} />
                    <button className={subtleButton}>{i.saved ? "Unsave" : "Save"}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
