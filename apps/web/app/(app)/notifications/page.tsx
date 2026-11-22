import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import type { FlashParams } from "../../../lib/form";
import { Card, Empty, Flash, PageHeader, subtleButton } from "../../../components/ui";
import { PushSettings } from "../../../components/push-settings";
import { QuietHoursForm } from "../../../components/quiet-hours-form";
import { PushKindsForm } from "../../../components/push-kinds-form";
import { loadPushKinds, loadQuietHours, markAllRead, markRead } from "./actions";

type Search = FlashParams & { view?: string };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "notifications");
  const { error, message, view } = await searchParams;
  const supabase = await createClient();
  const unreadOnly = view === "unread";

  let q = supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (unreadOnly) q = q.is("read_at", null);
  const [{ data }, { count }] = await Promise.all([
    q,
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const items = data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle="Created automatically about once an hour for upcoming dates, wishlist deadlines, venture tasks, due puzzles and reminders. Optionally also delivered as push on devices you turn it on for."
      />
      <Flash error={error} message={message} />
      <Card title="Push notifications" className="mb-6">
        <PushSettings publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        <PushKindsForm initial={await loadPushKinds()} />
        <QuietHoursForm initial={await loadQuietHours()} timezone={ctx.timezone} />
      </Card>
      <Card>
        <p className="mb-3 flex items-center gap-4 text-sm">
          <a
            href="/notifications"
            className={!unreadOnly ? "font-medium text-primary" : "text-muted"}
          >
            All
          </a>
          <a
            href="/notifications?view=unread"
            className={unreadOnly ? "font-medium text-primary" : "text-muted"}
          >
            Unread ({count ?? 0})
          </a>
          {(count ?? 0) > 0 && (
            <form action={markAllRead} className="ml-auto">
              <button className={subtleButton}>Mark all read</button>
            </form>
          )}
        </p>
        {items.length === 0 ? (
          <Empty>
            {unreadOnly
              ? "Nothing unread."
              : "No notifications yet. They appear when something you track is coming up."}
          </Empty>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {items.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 py-3 ${n.read_at ? "text-muted" : ""}`}
              >
                <span className="flex-1">
                  {n.link ? (
                    <a href={n.link} className={n.read_at ? "" : "font-medium text-primary"}>
                      {n.title}
                    </a>
                  ) : (
                    <span className={n.read_at ? "" : "font-medium"}>{n.title}</span>
                  )}
                  {n.body && <span className="block text-xs text-muted">{n.body}</span>}
                  <span className="block text-xs text-muted">
                    {n.created_at.slice(0, 16).replace("T", " ")} UTC
                  </span>
                </span>
                {!n.read_at && (
                  <form action={markRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className={subtleButton}>Mark read</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
