import { CV_KINDS } from "@kkingg/schemas";
import { requireModule } from "../../../../lib/modules";
import { formatRange, sortEntries } from "../../../../lib/career";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import type { FlashParams } from "../../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../../components/ui";
import { addCvEntry, deleteCvEntry, saveProfile } from "./actions";

export default async function CareerProfilePage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "career");
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase.from("career_profiles").select("*").eq("user_id", ctx.userId).maybeSingle(),
    supabase
      .from("cv_entries")
      .select(
        "id, kind, title, organisation, location, start_date, end_date, description, sort_order, revision",
      )
      .is("deleted_at", null),
  ]);
  const sorted = sortEntries(entries ?? []);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href="/career" className="text-primary">
          ← Career
        </a>
      </p>
      <PageHeader title="Profile and CV" subtitle="Used to build your printable CV." />
      <Flash error={error} message={message} />

      <Card title="Profile" className="mb-6">
        <form action={saveProfile} className="grid gap-3 sm:grid-cols-2">
          <input
            name="headline"
            maxLength={200}
            defaultValue={profile?.headline ?? ""}
            placeholder="Headline, e.g. Graduate civil engineer"
            aria-label="Headline"
            className={`${inputClass} sm:col-span-2`}
          />
          <textarea
            name="summary"
            rows={5}
            maxLength={4000}
            defaultValue={profile?.summary ?? ""}
            placeholder="Professional summary"
            aria-label="Summary"
            className={`${inputClass} sm:col-span-2`}
          />
          <input
            name="location"
            maxLength={120}
            defaultValue={profile?.location ?? ""}
            placeholder="Location"
            aria-label="Location"
            className={inputClass}
          />
          <input
            name="website"
            type="url"
            defaultValue={profile?.website ?? ""}
            placeholder="Website"
            aria-label="Website"
            className={inputClass}
          />
          <input
            name="linkedinUrl"
            type="url"
            defaultValue={profile?.linkedin_url ?? ""}
            placeholder="LinkedIn link"
            aria-label="LinkedIn link"
            className={inputClass}
          />
          <input
            name="githubUrl"
            type="url"
            defaultValue={profile?.github_url ?? ""}
            placeholder="GitHub link"
            aria-label="GitHub link"
            className={inputClass}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-2`}>
            Save profile
          </button>
        </form>
      </Card>

      <Card title="Add a CV entry" className="mb-6">
        <form action={addCvEntry} className="grid gap-3 sm:grid-cols-6">
          <select
            name="kind"
            defaultValue="experience"
            aria-label="Type"
            className={`${inputClass} sm:col-span-2`}
          >
            {CV_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Title or degree"
            aria-label="Title"
            className={`${inputClass} sm:col-span-4`}
          />
          <input
            name="organisation"
            maxLength={200}
            placeholder="Organisation"
            aria-label="Organisation"
            className={`${inputClass} sm:col-span-3`}
          />
          <input
            name="location"
            maxLength={120}
            placeholder="Location"
            aria-label="Location"
            className={`${inputClass} sm:col-span-3`}
          />
          <label className="text-xs text-muted sm:col-span-3">
            Start
            <input name="startDate" type="date" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs text-muted sm:col-span-3">
            End (blank = present)
            <input name="endDate" type="date" className={`${inputClass} mt-1`} />
          </label>
          <textarea
            name="description"
            rows={3}
            maxLength={4000}
            placeholder="Details (one achievement per line)"
            aria-label="Details"
            className={`${inputClass} sm:col-span-6`}
          />
          <button type="submit" className={`${primaryButton} sm:col-span-6`}>
            Add entry
          </button>
        </form>
      </Card>

      {sorted.length ? (
        <ul className="space-y-3">
          {sorted.map((e) => (
            <li key={e.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{e.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {e.kind}
                    {e.organisation ? ` · ${e.organisation}` : ""}
                    {formatRange(e.start_date, e.end_date)
                      ? ` · ${formatRange(e.start_date, e.end_date)}`
                      : ""}
                  </p>
                </div>
                <form action={deleteCvEntry}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="revision" value={e.revision} />
                  <button type="submit" className={subtleButton}>
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No CV entries yet.</Empty>
      )}
    </div>
  );
}
