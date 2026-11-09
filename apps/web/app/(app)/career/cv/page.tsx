import { CV_KINDS } from "@kkingg/schemas";
import { requireModule } from "../../../../lib/modules";
import { formatRange, sortEntries } from "../../../../lib/career";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";

const SECTION_TITLES: Record<string, string> = {
  experience: "Experience",
  education: "Education",
  project: "Projects",
  certification: "Certifications",
  award: "Awards",
  skill: "Skills",
  other: "Other",
};

export default async function CvPage() {
  const ctx = await getAppContext();
  requireModule(ctx, "career");
  const supabase = await createClient();
  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase.from("career_profiles").select("*").eq("user_id", ctx.userId).maybeSingle(),
    supabase
      .from("cv_entries")
      .select(
        "id, kind, title, organisation, location, start_date, end_date, description, sort_order",
      )
      .is("deleted_at", null),
  ]);
  const all = sortEntries(entries ?? []);
  const links = [profile?.website, profile?.linkedin_url, profile?.github_url].filter(
    Boolean,
  ) as string[];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-4 text-sm print:hidden">
        <a href="/career/profile" className="text-primary">
          ← Edit profile and entries
        </a>
        <span className="ml-3 text-muted">
          Print this page (Ctrl+P or Cmd+P) to save it as a PDF.
        </span>
      </p>
      <article className="rounded-lg border border-border bg-white p-8 text-black print:border-0 print:p-0">
        <h1 className="text-2xl font-semibold">{ctx.displayName}</h1>
        {profile?.headline && <p className="mt-1 text-base">{profile.headline}</p>}
        <p className="mt-1 text-xs text-neutral-600">
          {[ctx.email, profile?.location, ...links].filter(Boolean).join(" · ")}
        </p>
        {profile?.summary && <p className="mt-4 whitespace-pre-wrap text-sm">{profile.summary}</p>}

        {CV_KINDS.filter((k) => all.some((e) => e.kind === k))
          .sort(
            (a, b) =>
              Object.keys(SECTION_TITLES).indexOf(a) - Object.keys(SECTION_TITLES).indexOf(b),
          )
          .map((kind) => (
            <section key={kind} className="mt-5">
              <h2 className="border-b border-neutral-300 pb-1 text-sm font-semibold uppercase tracking-wide">
                {SECTION_TITLES[kind]}
              </h2>
              <ul className="mt-2 space-y-3">
                {all
                  .filter((e) => e.kind === kind)
                  .map((e) => (
                    <li key={e.id} className="text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="font-medium">
                          {e.title}
                          {e.organisation ? `, ${e.organisation}` : ""}
                        </span>
                        <span className="shrink-0 text-xs text-neutral-600">
                          {formatRange(e.start_date, e.end_date)}
                        </span>
                      </div>
                      {e.location && <p className="text-xs text-neutral-600">{e.location}</p>}
                      {e.description && <p className="mt-1 whitespace-pre-wrap">{e.description}</p>}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        {all.length === 0 && !profile && (
          <p className="mt-6 text-sm text-neutral-600">
            Nothing to show yet. Add a profile and entries first.
          </p>
        )}
      </article>
    </div>
  );
}
