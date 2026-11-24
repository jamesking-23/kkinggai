// Vault helpers, mirroring the website's rules (packages/schemas vaultNoteSchema and vaultLinkSchema). Pure.
// The vault is private to the owner. It is NOT end-to-end encrypted: do not store passwords or card numbers.

export type VaultKind = "note" | "link" | "file";

export type VaultRow = {
  id: string;
  kind: VaultKind;
  title: string;
  body: string;
  url: string | null;
  category: string | null;
  tags: string[];
  storage_path: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type VaultFilter = VaultKind | "all";

export function filterVault(
  items: readonly VaultRow[],
  kind: VaultFilter,
  query: string,
): VaultRow[] {
  const q = query.trim().toLowerCase();
  return items.filter(
    (i) =>
      (kind === "all" || i.kind === kind) &&
      (!q ||
        i.title.toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))),
  );
}

/** Tags from comma-separated text: trimmed, at most 20, each at most 30 characters (website rules), or an error message. */
export function parseTags(text: string): string[] | string {
  const list = text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (list.length > 20) return "Use at most 20 tags.";
  if (list.some((t) => t.length > 30)) return "Each tag can be at most 30 characters.";
  return list;
}

export type NewItem = {
  kind: "note" | "link";
  title: string;
  body: string;
  url: string | null;
  category: string | null;
  tags: string[];
};

/** A validated note or link, or an error message. Links must be http or https. */
export function checkItem(
  kind: "note" | "link",
  title: string,
  body: string,
  url: string,
  category: string,
  tags: string,
): NewItem | string {
  const t = title.trim();
  if (!t) return "Enter a title.";
  if (t.length > 200) return "The title is too long (200 characters at most).";
  if (body.length > 20000) return "The text is too long (20,000 characters at most).";
  const cat = category.trim();
  if (cat.length > 60) return "The category is too long (60 characters at most).";
  const tg = parseTags(tags);
  if (typeof tg === "string") return tg;
  let link: string | null = null;
  if (kind === "link") {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return "Links must start with http:// or https://";
    try {
      link = new URL(u).toString();
    } catch {
      return "Enter a valid link.";
    }
  }
  return { kind, title: t, body, url: link, category: cat || null, tags: tg };
}

export function sizeText(bytes: number | null): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const kindText = (k: VaultKind) => (k === "note" ? "Note" : k === "link" ? "Link" : "File");
