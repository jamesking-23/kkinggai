import { MEDIA_KINDS, MEDIA_STATUSES } from "@kkingg/schemas";
import { requireModule } from "../../../lib/modules";
import { KIND_LABELS, STATUS_LABELS, stars, summarise } from "../../../lib/media";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { localDate } from "../../../lib/time";
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
import { addMedia, deleteMedia, setMediaStatus } from "./actions";

type Search = FlashParams & { status?: string; kind?: string };

export default async function EntertainmentPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "entertainment");
  const { error, message, status, kind } = await searchParams;
  const supabase = await createClient();
  const year = localDate(new Date(), ctx.timezone).slice(0, 4);

  const { data } = await supabase
    .from("media_items")
    .select(
      "id, kind, title, creator, status, rating, started_on, finished_on, notes, tags, revision",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  const all = data ?? [];
  const sum = summarise(all, year);
  const fStatus = MEDIA_STATUSES.find((s) => s === status);
  const fKind = MEDIA_KINDS.find((k) => k === kind);
  const shown = all.filter(
    (m) => (!fStatus || m.status === fStatus) && (!fKind || m.kind === fKind),
  );
  const link = (s?: string, k?: string) =>
    `/entertainment?${[s ? `status=${s}` : "", k ? `kind=${k}` : ""].filter(Boolean).join("&")}`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Entertainment"
        subtitle="Books, films, shows, games, music and podcasts. Private to you."
      />
      <Flash error={error} message={message} />

      <Card title="Add" className="mb-6">
        <form action={addMedia} className="grid gap-3 sm:grid-cols-6">
          <select
            name="kind"
            defaultValue="book"
            aria-label="Kind"
            className={`${inputClass} sm:col-span-1`}
          >
            {MEDIA_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Title"
            aria-label="Title"
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="creator"
            maxLength={160}
            placeholder="Author, director, artist"
            aria-label="Creator"
            className={`${inputClass} sm:col-span-2`}
          />
          <select
            name="status"
            defaultValue="wishlist"
            aria-label="Status"
            className={`${inputClass} sm:col-span-2`}
          >
            {MEDIA_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            name="rating"
            defaultValue=""
            aria-label="Rating"
            className={`${inputClass} sm:col-span-1`}
          >
            <option value="">Rating</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <input
            name="startedOn"
            type="date"
            aria-label="Started"
            className={`${inputClass} sm:col-span-1`}
          />
          <input
            name="finishedOn"
            type="date"
            aria-label="Finished"
            className={`${inputClass} sm:col-span-1`}
          />
          <input
            name="tags"
            placeholder="Tags, comma separated"
            aria-label="Tags"
            className={`${inputClass} sm:col-span-1`}
          />
          <input
            name="notes"
            maxLength={4000}
            placeholder="Notes"
            aria-label="Notes"
            className={`${inputClass} sm:col-span-5`}
          />
          <button className={`${primaryButton} sm:col-span-1`}>Add</button>
        </form>
      </Card>

      <Card title="Your list">
        <p className="mb-2 flex flex-wrap gap-3 text-sm">
          <a
            href={link(undefined, fKind)}
            className={!fStatus ? "font-medium text-primary" : "text-muted"}
          >
            All ({all.length})
          </a>
          {MEDIA_STATUSES.map((s) => (
            <a
              key={s}
              href={link(s, fKind)}
              className={fStatus === s ? "font-medium text-primary" : "text-muted"}
            >
              {STATUS_LABELS[s]} ({sum.byStatus[s]})
            </a>
          ))}
        </p>
        <p className="mb-3 flex flex-wrap gap-3 text-xs">
          <a href={link(fStatus)} className={!fKind ? "font-medium text-primary" : "text-muted"}>
            Every kind
          </a>
          {MEDIA_KINDS.map((k) => (
            <a
              key={k}
              href={link(fStatus, k)}
              className={fKind === k ? "font-medium text-primary" : "text-muted"}
            >
              {KIND_LABELS[k]}
            </a>
          ))}
        </p>
        <p className="mb-4 text-xs text-muted">
          Finished in {year}:{" "}
          {Object.keys(sum.doneThisYear).length
            ? Object.entries(sum.doneThisYear)
                .map(([k, n]) => `${n} ${KIND_LABELS[k]?.toLowerCase() ?? k}`)
                .join(", ")
            : "nothing yet"}
          {sum.averageRating !== null && ` · Average rating ${sum.averageRating}`}
        </p>
        {shown.length === 0 ? (
          <Empty>
            {all.length === 0
              ? "Nothing here yet. Add something above."
              : "Nothing matches this filter."}
          </Empty>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {shown.map((m) => (
              <li key={m.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.title}</span>
                  <span className="text-xs text-muted">
                    {KIND_LABELS[m.kind]}
                    {m.creator ? ` · ${m.creator}` : ""}
                  </span>
                  {m.rating && <span aria-label={`${m.rating} of 5`}>{stars(m.rating)}</span>}
                  {m.tags.length > 0 && (
                    <span className="text-xs text-muted">
                      {m.tags.map((t) => `#${t}`).join(" ")}
                    </span>
                  )}
                </div>
                {m.notes && <p className="mt-1 text-muted">{m.notes}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <form action={setMediaStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="revision" value={m.revision} />
                    <input type="hidden" name="tz" value={ctx.timezone} />
                    {m.finished_on && <input type="hidden" name="hasFinished" value="1" />}
                    <select
                      name="status"
                      defaultValue={m.status}
                      aria-label="Status"
                      className={inputClass}
                    >
                      {MEDIA_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <select
                      name="rating"
                      defaultValue={m.rating ?? ""}
                      aria-label="Rating"
                      className={inputClass}
                    >
                      <option value="">No rating</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button className={subtleButton}>Update</button>
                  </form>
                  <form action={deleteMedia}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="revision" value={m.revision} />
                    <button className={subtleButton}>Remove</button>
                  </form>
                  {(m.started_on || m.finished_on) && (
                    <span className="text-xs text-muted">
                      {m.started_on ? `Started ${m.started_on}` : ""}
                      {m.finished_on ? ` Finished ${m.finished_on}` : ""}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
