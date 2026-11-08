import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { Card, Empty, Flash, inputClass, PageHeader, subtleButton } from "../../../components/ui";
import type { FlashParams } from "../../../lib/form";
import { addFile, addLink, addNote, deleteItem } from "./actions";

const SIGNED_URL_SECONDS = 300;

function size(bytes: number | null) {
  if (bytes === null) return "";
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function VaultPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "vault");
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("vault_items")
    .select(
      "id, kind, title, body, url, category, tags, storage_path, size_bytes, revision, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const items = data ?? [];

  const paths = items.flatMap((i) => (i.storage_path ? [i.storage_path] : []));
  const signed = paths.length
    ? ((await supabase.storage.from("vault").createSignedUrls(paths, SIGNED_URL_SECONDS)).data ??
      [])
    : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: ctx.timezone });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Vault" subtitle="Private to you. Not shared with any workspace member." />
      <Flash error={error} message={message} />
      <p className="mb-6 rounded-md border border-border px-3 py-2 text-xs text-muted">
        Items are encrypted at rest by the database provider, but not end-to-end encrypted. Do not
        store passwords, recovery codes or card numbers here yet.
      </p>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card title="Note">
          <form action={addNote} className="space-y-2">
            <input
              name="title"
              required
              maxLength={200}
              placeholder="Title"
              aria-label="Note title"
              className={inputClass}
            />
            <textarea
              name="body"
              rows={3}
              maxLength={20000}
              placeholder="Text"
              aria-label="Note text"
              className={inputClass}
            />
            <input
              name="tags"
              placeholder="Tags, comma separated"
              aria-label="Tags"
              className={inputClass}
            />
            <button type="submit" className={subtleButton}>
              Save note
            </button>
          </form>
        </Card>
        <Card title="Link">
          <form action={addLink} className="space-y-2">
            <input
              name="title"
              required
              maxLength={200}
              placeholder="Title"
              aria-label="Link title"
              className={inputClass}
            />
            <input
              name="url"
              type="url"
              required
              placeholder="https://"
              aria-label="Link address"
              className={inputClass}
            />
            <input
              name="tags"
              placeholder="Tags, comma separated"
              aria-label="Tags"
              className={inputClass}
            />
            <button type="submit" className={subtleButton}>
              Save link
            </button>
          </form>
        </Card>
        <Card title="File">
          <form action={addFile} className="space-y-2">
            <input
              name="title"
              maxLength={200}
              placeholder="Title (optional)"
              aria-label="File title"
              className={inputClass}
            />
            <input name="file" type="file" required aria-label="File" className="w-full text-xs" />
            <p className="text-xs text-muted">PDF, images, text, Word or Excel, up to 4 MB.</p>
            <button type="submit" className={subtleButton}>
              Upload
            </button>
          </form>
        </Card>
      </div>

      {items.length ? (
        <ul className="space-y-3">
          {items.map((i) => {
            const href =
              i.kind === "link" ? i.url : i.storage_path ? urlFor.get(i.storage_path) : null;
            return (
              <li key={i.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {i.title}
                        </a>
                      ) : (
                        i.title
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {i.kind}
                      {i.kind === "file" ? ` · ${size(i.size_bytes)}` : ""} ·{" "}
                      {dateFmt.format(new Date(i.created_at))}
                      {i.tags.length ? ` · ${i.tags.join(", ")}` : ""}
                    </p>
                    {i.body && <p className="mt-2 whitespace-pre-wrap text-sm">{i.body}</p>}
                  </div>
                  <form action={deleteItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="revision" value={i.revision} />
                    <button type="submit" className={subtleButton}>
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>Your vault is empty.</Empty>
      )}
    </div>
  );
}
