import { lookup as dnsLookup } from "node:dns/promises";

export type FeedItem = {
  guid: string;
  title: string;
  link: string | null;
  summary: string;
  publishedAt: string | null;
};
export type ParsedFeed = { title: string; items: FeedItem[] };

export class FeedError extends Error {}

export const FEED_MAX_BYTES = 1_000_000;
export const FEED_MAX_ITEMS = 50;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;

// ---------- parsing (regex based, no XML parser, so no entity expansion or external entities) ----------

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : "";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Removes markup and returns collapsed plain text, at most `max` characters. */
export function toText(raw: string, max: number): string {
  const noCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const noScripts = noCdata.replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, " ");
  const stripped = decodeEntities(noScripts.replace(/<[^>]*>/g, " "));
  // Entities may decode to markup characters; strip once more so none survive as tags.
  const text = stripped
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`, "i").exec(block);
  return m ? m[1]! : null;
}

function httpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
  if (v.length > 1000 || !/^https?:\/\//i.test(v)) return null;
  try {
    return new URL(v).toString();
  } catch {
    return null;
  }
}

function atomLink(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*)>/gi)].map((m) => m[1]!);
  const pick =
    links.find((a) => !/rel\s*=/i.test(a) || /rel\s*=\s*["']alternate["']/i.test(a)) ?? links[0];
  const href = pick ? /href\s*=\s*["']([^"']+)["']/i.exec(pick) : null;
  return httpUrl(href?.[1]);
}

function isoDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(toText(raw, 80));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function parseFeed(xml: string): ParsedFeed {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const itemRe = isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi;
  const blocks = xml.match(itemRe);
  if (!blocks) {
    if (/<(rss|feed|rdf:RDF)[\s>]/i.test(xml)) return { title: feedTitle(xml, isAtom), items: [] };
    throw new FeedError("That address did not return an RSS or Atom feed.");
  }
  const items: FeedItem[] = [];
  for (const b of blocks.slice(0, FEED_MAX_ITEMS)) {
    const title = toText(tag(b, "title") ?? "", 500);
    if (!title) continue;
    const link = isAtom ? atomLink(b) : httpUrl(tag(b, "link"));
    const publishedAt = isoDate(
      isAtom ? (tag(b, "published") ?? tag(b, "updated")) : tag(b, "pubDate"),
    );
    const rawGuid = toText((isAtom ? tag(b, "id") : tag(b, "guid")) ?? "", 500);
    const guid = rawGuid || link || `${title}|${publishedAt ?? ""}`.slice(0, 500);
    const summary = toText(
      (isAtom ? (tag(b, "summary") ?? tag(b, "content")) : tag(b, "description")) ?? "",
      1000,
    );
    items.push({ guid, title, link, summary, publishedAt });
  }
  return { title: feedTitle(xml, isAtom), items };
}

function feedTitle(xml: string, isAtom: boolean): string {
  // The channel or feed title is the first title that is not inside an item or entry.
  const head = xml.replace(isAtom ? /<entry[\s>][\s\S]*/i : /<item[\s>][\s\S]*/i, "");
  return toText(tag(head, "title") ?? "", 200);
}

// ---------- safe fetching ----------

function ipv4Private(h: string): boolean {
  const p = h.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** True for addresses a server must never be pointed at: loopback, private, link-local, metadata, IPv6 literals. */
export function isBlockedAddress(addr: string): boolean {
  const a = addr
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (a.includes(":")) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
    if (mapped) return ipv4Private(mapped[1]!);
    return !/^[23][0-9a-f]{3}:/.test(a); // only global unicast 2000::/3 is allowed
  }
  return ipv4Private(a);
}

/** Checks a URL string before any network access. Throws FeedError with a reason fit to show the user. */
export function checkFeedUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new FeedError("Enter a valid web address.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new FeedError("Feed addresses must start with http:// or https://.");
  if (u.username || u.password)
    throw new FeedError("Addresses with a username or password are not allowed.");
  if (u.port && u.port !== "80" && u.port !== "443")
    throw new FeedError("Only the standard web ports (80 and 443) are allowed.");
  const host = u.hostname.toLowerCase();
  const literal = /^[\d.]+$/.test(host) || host.startsWith("[");
  if (
    literal
      ? isBlockedAddress(host)
      : !host.includes(".") || /\.(local|localhost|internal|lan|home|corp)$/.test(host)
  )
    throw new FeedError(
      "That address points to a private or local network, so it cannot be fetched.",
    );
  return u;
}

export type Resolver = (host: string) => Promise<string[]>;
const defaultResolver: Resolver = async (host) =>
  (await dnsLookup(host, { all: true })).map((r) => r.address);

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, FEED_MAX_BYTES);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > FEED_MAX_BYTES) {
      await reader.cancel();
      throw new FeedError("That feed is too large (over 1 MB).");
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/**
 * Fetches and parses a feed. Every hop (including redirects) is checked, the host is resolved and each address
 * checked, redirects are followed by hand (at most 3), and the body is capped at 1 MB with an 8 second timeout.
 * Limitation: the address is checked before connecting but the connection resolves it again, so a hostile DNS
 * server could still change its answer in between (DNS rebinding); this is reduced, not eliminated.
 */
export async function fetchFeed(
  rawUrl: string,
  opts: { fetchImpl?: typeof fetch; resolve?: Resolver } = {},
): Promise<ParsedFeed & { finalUrl: string }> {
  const doFetch = opts.fetchImpl ?? fetch;
  const resolve = opts.resolve ?? defaultResolver;
  let url = checkFeedUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (/^[\d.]+$/.test(url.hostname) === false && !url.hostname.startsWith("[")) {
      let addrs: string[];
      try {
        addrs = await resolve(url.hostname);
      } catch {
        throw new FeedError("That address could not be found.");
      }
      if (addrs.length === 0 || addrs.some(isBlockedAddress))
        throw new FeedError(
          "That address points to a private or local network, so it cannot be fetched.",
        );
    }
    let res: Response;
    try {
      res = await doFetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "KKINGG-AI-feed-reader/1.0",
          accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
        },
      });
    } catch {
      throw new FeedError("Could not reach that address.");
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new FeedError("The feed redirected without saying where.");
      url = checkFeedUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) throw new FeedError(`The feed returned an error (HTTP ${res.status}).`);
    const parsed = parseFeed(await readLimited(res));
    return { ...parsed, finalUrl: url.toString() };
  }
  throw new FeedError("The feed redirected too many times.");
}
