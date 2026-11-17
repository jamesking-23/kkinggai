import { describe, expect, it, vi } from "vitest";
import {
  checkFeedUrl,
  decodeEntities,
  fetchFeed,
  FeedError,
  isBlockedAddress,
  parseFeed,
  toText,
} from "./feeds";

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example &amp; News</title>
  <item>
    <title><![CDATA[First <b>story</b>]]></title>
    <link>https://example.com/a?x=1&amp;y=2</link>
    <guid isPermaLink="false">abc-1</guid>
    <pubDate>Tue, 17 Nov 2026 08:00:00 GMT</pubDate>
    <description><![CDATA[<p>Hello <script>alert(1)</script>world &amp; more</p>]]></description>
  </item>
  <item>
    <title>Second</title>
    <link>javascript:alert(1)</link>
  </item>
  <item><title></title></item>
</channel></rss>`;

const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Blog</title>
  <entry>
    <title>Entry one</title>
    <id>tag:example.com,2026:1</id>
    <link rel="self" href="https://example.com/self"/>
    <link rel="alternate" href="https://example.com/one"/>
    <updated>2026-11-16T10:00:00Z</updated>
    <summary>Short &lt;i&gt;text&lt;/i&gt;</summary>
  </entry>
</feed>`;

describe("text helpers", () => {
  it("decodes named and numeric entities safely", () => {
    expect(decodeEntities("a &amp; b &#65; &#x42; &bogus; &#0;")).toBe("a & b A B &bogus; ");
  });
  it("strips markup, scripts and entity-encoded tags", () => {
    expect(toText("<p>Hi <script>x()</script><b>there</b></p>", 100)).toBe("Hi there");
    expect(toText("&lt;script&gt;alert(1)&lt;/script&gt;ok", 100)).toBe("alert(1) ok");
    expect(toText("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("parseFeed", () => {
  it("parses RSS, skipping empty titles and unsafe links", () => {
    const f = parseFeed(RSS);
    expect(f.title).toBe("Example & News");
    expect(f.items).toHaveLength(2);
    expect(f.items[0]).toEqual({
      guid: "abc-1",
      title: "First story",
      link: "https://example.com/a?x=1&y=2",
      summary: "Hello world & more",
      publishedAt: "2026-11-17T08:00:00.000Z",
    });
    expect(f.items[1]!.link).toBeNull();
    expect(f.items[1]!.guid).toBe("Second|");
  });
  it("parses Atom and prefers the alternate link", () => {
    const f = parseFeed(ATOM);
    expect(f.title).toBe("Atom Blog");
    expect(f.items[0]).toMatchObject({
      guid: "tag:example.com,2026:1",
      link: "https://example.com/one",
      summary: "Short text",
      publishedAt: "2026-11-16T10:00:00.000Z",
    });
  });
  it("accepts an empty feed and rejects non-feeds", () => {
    expect(parseFeed("<rss><channel><title>T</title></channel></rss>")).toEqual({
      title: "T",
      items: [],
    });
    expect(() => parseFeed("<html><body>nope</body></html>")).toThrow(FeedError);
  });
  it("does not expand entity declarations", () => {
    const f = parseFeed(
      `<!DOCTYPE x [<!ENTITY e "BOOM">]><rss><channel><title>&e;</title><item><title>&e;</title></item></channel></rss>`,
    );
    expect(f.title).toBe("&e;");
  });
  it("caps the number of items", () => {
    const many = `<rss><channel>${Array.from({ length: 80 }, (_, i) => `<item><title>t${i}</title></item>`).join("")}</channel></rss>`;
    expect(parseFeed(many).items).toHaveLength(50);
  });
});

describe("address and URL checks", () => {
  it("blocks private, loopback, link-local and metadata addresses", () => {
    for (const a of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
    ])
      expect(isBlockedAddress(a), a).toBe(true);
    for (const a of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700::1111"])
      expect(isBlockedAddress(a), a).toBe(false);
  });
  it("rejects unsafe URLs before any network access", () => {
    for (const u of [
      "ftp://example.com/f",
      "http://localhost/f",
      "http://intranet/f",
      "http://printer.local/f",
      "http://127.0.0.1/f",
      "http://2130706433/f",
      "http://[::1]/f",
      "http://user:pw@example.com/f",
      "http://example.com:8080/f",
      "not a url",
    ])
      expect(() => checkFeedUrl(u), u).toThrow(FeedError);
    expect(checkFeedUrl("https://example.com/feed.xml").hostname).toBe("example.com");
  });
});

const ok = (body: string) => new Response(body, { status: 200 });
const publicDns = async () => ["93.184.216.34"];

describe("fetchFeed", () => {
  it("fetches and parses a feed", async () => {
    const f = vi.fn(async () => ok(RSS));
    const r = await fetchFeed("https://example.com/feed", {
      fetchImpl: f as never,
      resolve: publicDns,
    });
    expect(r.items).toHaveLength(2);
    expect(r.finalUrl).toBe("https://example.com/feed");
    expect(f).toHaveBeenCalledOnce();
  });
  it("refuses hosts that resolve to private addresses without fetching", async () => {
    const f = vi.fn();
    await expect(
      fetchFeed("https://evil.example/feed", {
        fetchImpl: f as never,
        resolve: async () => ["10.0.0.5"],
      }),
    ).rejects.toThrow(/private or local/);
    await expect(
      fetchFeed("https://evil.example/feed", {
        fetchImpl: f as never,
        resolve: async () => ["93.184.216.34", "127.0.0.1"],
      }),
    ).rejects.toThrow(/private or local/);
    expect(f).not.toHaveBeenCalled();
  });
  it("follows redirects but checks every hop", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/next" } }))
      .mockResolvedValueOnce(ok(ATOM));
    const r = await fetchFeed("https://example.com/a", {
      fetchImpl: f as never,
      resolve: publicDns,
    });
    expect(r.finalUrl).toBe("https://example.com/next");

    const bad = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 301, headers: { location: "http://169.254.169.254/x" } }),
      );
    await expect(
      fetchFeed("https://example.com/a", { fetchImpl: bad as never, resolve: publicDns }),
    ).rejects.toThrow(/private or local/);
  });
  it("stops after too many redirects", async () => {
    const loop = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: "/again" } }),
    );
    await expect(
      fetchFeed("https://example.com/a", { fetchImpl: loop as never, resolve: publicDns }),
    ).rejects.toThrow(/too many times/);
  });
  it("reports HTTP errors, network errors and oversized bodies", async () => {
    await expect(
      fetchFeed("https://example.com/a", {
        fetchImpl: (async () => new Response("x", { status: 404 })) as never,
        resolve: publicDns,
      }),
    ).rejects.toThrow(/HTTP 404/);
    await expect(
      fetchFeed("https://example.com/a", {
        fetchImpl: (async () => {
          throw new Error("boom");
        }) as never,
        resolve: publicDns,
      }),
    ).rejects.toThrow(/Could not reach/);
    await expect(
      fetchFeed("https://example.com/a", {
        fetchImpl: (async () => ok("x".repeat(1_000_001))) as never,
        resolve: publicDns,
      }),
    ).rejects.toThrow(/too large/);
  });
});
