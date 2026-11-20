import { ENTRY_KINDS, VENTURE_STAGES } from "@kkingg/schemas";
import { requireModule } from "../../../lib/modules";
import { formatMoney, monthly, totals } from "../../../lib/ventures";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { localDate } from "../../../lib/time";
import type { FlashParams } from "../../../lib/form";
import {
  Card,
  StatTile,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../components/ui";
import { addEntry, createVenture, deleteEntry, deleteVenture, setVentureStage } from "./actions";

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "business");
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const [{ data: ventures }, { data: entries }] = await Promise.all([
    supabase
      .from("ventures")
      .select("id, name, description, stage, currency, website, started_on, revision")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("venture_entries")
      .select("id, venture_id, kind, amount, occurred_on, category, description, revision")
      .is("deleted_at", null)
      .order("occurred_on", { ascending: false })
      .limit(2000),
  ]);
  const list = ventures ?? [];
  const all = entries ?? [];
  const today = localDate(new Date(), ctx.timezone);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Business"
        subtitle="Private to you. Not shared with any workspace member."
      />
      <Flash error={error} message={message} />

      <Card title="New venture" className="mb-6">
        <form action={createVenture} className="grid gap-3 sm:grid-cols-6">
          <input
            name="name"
            required
            maxLength={120}
            placeholder="Name"
            aria-label="Name"
            className={`${inputClass} sm:col-span-3`}
          />
          <select
            name="stage"
            defaultValue="idea"
            aria-label="Stage"
            className={`${inputClass} sm:col-span-2`}
          >
            {VENTURE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="currency"
            defaultValue="UGX"
            maxLength={3}
            aria-label="Currency"
            className={`${inputClass} sm:col-span-1`}
          />
          <input
            name="website"
            type="url"
            placeholder="Website (optional)"
            aria-label="Website"
            className={`${inputClass} sm:col-span-4`}
          />
          <input
            name="startedOn"
            type="date"
            aria-label="Started on"
            className={`${inputClass} sm:col-span-2`}
          />
          <textarea
            name="description"
            rows={2}
            maxLength={4000}
            placeholder="What is it?"
            aria-label="Description"
            className={`${inputClass} sm:col-span-6`}
          />
          <button className={`${primaryButton} sm:col-span-6`}>Add venture</button>
        </form>
      </Card>

      {list.length === 0 ? (
        <Empty>No ventures yet. Add one above, then record income and expenses against it.</Empty>
      ) : (
        list.map((v) => {
          const mine = all.filter((e) => e.venture_id === v.id);
          const t = totals(mine);
          const months = monthly(mine);
          return (
            <Card key={v.id} title={v.name} className="mb-6">
              <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                <form action={setVentureStage} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="revision" value={v.revision} />
                  <select
                    name="stage"
                    defaultValue={v.stage}
                    aria-label="Stage"
                    className={inputClass}
                  >
                    {VENTURE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button className={subtleButton}>Update</button>
                </form>
                {v.website && (
                  <a href={v.website} rel="noopener noreferrer" className="text-primary">
                    Website
                  </a>
                )}
                {v.started_on && <span className="text-muted">Started {v.started_on}</span>}
                <a href={`/business/${v.id}`} className="text-primary">
                  Tasks and contacts
                </a>
                <form action={deleteVenture} className="ml-auto">
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="revision" value={v.revision} />
                  <button className={subtleButton}>Remove</button>
                </form>
              </div>
              {v.description && <p className="mb-3 text-sm text-muted">{v.description}</p>}

              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <StatTile label="Income" value={formatMoney(t.income, v.currency)} />
                <StatTile label="Expenses" value={formatMoney(t.expense, v.currency)} />
                <StatTile
                  label="Net"
                  value={formatMoney(t.net, v.currency)}
                  tone={t.net < 0 ? "danger" : t.net > 0 ? "success" : "default"}
                />
              </div>
              {months.length > 0 && (
                <ul className="mb-4 space-y-1 text-xs tabular-nums text-muted">
                  {months.map((m) => (
                    <li key={m.month}>
                      {m.month}: in {formatMoney(m.income, v.currency)}, out{" "}
                      {formatMoney(m.expense, v.currency)}, net {formatMoney(m.net, v.currency)}
                    </li>
                  ))}
                </ul>
              )}

              <form action={addEntry} className="mb-4 grid gap-3 sm:grid-cols-6">
                <input type="hidden" name="ventureId" value={v.id} />
                <select name="kind" aria-label="Kind" className={`${inputClass} sm:col-span-1`}>
                  {ENTRY_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  placeholder={`Amount (${v.currency})`}
                  aria-label="Amount"
                  className={`${inputClass} sm:col-span-2`}
                />
                <input
                  name="occurredOn"
                  type="date"
                  defaultValue={today}
                  aria-label="Date"
                  className={`${inputClass} sm:col-span-2`}
                />
                <input
                  name="category"
                  maxLength={60}
                  placeholder="Category"
                  aria-label="Category"
                  className={`${inputClass} sm:col-span-1`}
                />
                <input
                  name="description"
                  maxLength={500}
                  placeholder="Note (optional)"
                  aria-label="Note"
                  className={`${inputClass} sm:col-span-5`}
                />
                <button className={`${primaryButton} sm:col-span-1`}>Add</button>
              </form>

              {mine.length === 0 ? (
                <p className="text-sm text-muted">No entries yet.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {mine.slice(0, 20).map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2">
                      <span className="w-24 shrink-0 text-muted">{e.occurred_on}</span>
                      <span className="flex-1">
                        {e.kind === "income" ? "+" : "-"}
                        {formatMoney(Number(e.amount), v.currency)}
                        {e.category ? ` · ${e.category}` : ""}
                        {e.description ? ` · ${e.description}` : ""}
                      </span>
                      <form action={deleteEntry}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="revision" value={e.revision} />
                        <button className={subtleButton}>Remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {mine.length > 20 && (
                <p className="mt-2 text-xs text-muted">
                  Showing the latest 20 of {mine.length} entries. Totals include all of them.
                </p>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
