import { describe, expect, it } from "vitest";
import {
  feedName,
  filterItems,
  plainSummary,
  safeLink,
  shortDate,
  unreadByFeed,
  type NewsItem,
} from "./news";

const item = (id: string, feed: string, read: boolean, saved: boolean): NewsItem => ({
  id,
  feed_id: feed,
  title: id,
  link: null,
  summary: null,
  published_at: null,
  read_at: read ? "2026-11-01T00:00:00Z" : null,
  saved,
});

describe("news", () => {
  it("allows only web links", () => {
    expect(safeLink("https://example.com/a")).toBe("https://example.com/a");
    expect(safeLink("http://example.com")).toBe("http://example.com/");
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("file:///etc/passwd")).toBeNull();
    expect(safeLink("not a url")).toBeNull();
    expect(safeLink(null)).toBeNull();
  });

  it("names feeds", () => {
    expect(feedName({ title: " BBC ", url: "https://x.com/rss" })).toBe("BBC");
    expect(feedName({ title: null, url: "https://x.com/rss" })).toBe("x.com");
    expect(feedName({ title: "", url: "bad" })).toBe("bad");
  });

  it("filters and counts", () => {
    const items = [
      item("a", "f1", false, false),
      item("b", "f1", true, true),
      item("c", "f2", false, true),
    ];
    expect(filterItems(items, "unread", null).map((i) => i.id)).toEqual(["a", "c"]);
    expect(filterItems(items, "saved", null).map((i) => i.id)).toEqual(["b", "c"]);
    expect(filterItems(items, "all", "f1").map((i) => i.id)).toEqual(["a", "b"]);
    expect(unreadByFeed(items).get("f1")).toBe(1);
    expect(unreadByFeed(items).get("f2")).toBe(1);
  });

  it("formats dates and summaries", () => {
    expect(shortDate("2026-11-24T10:00:00Z")).toBe("24 Nov");
    expect(shortDate(null)).toBe("");
    expect(shortDate("nope")).toBe("");
    expect(plainSummary("<p>Fish &amp; chips&nbsp;now</p>")).toBe("Fish & chips now");
    expect(plainSummary("x".repeat(300), 10)).toBe("xxxxxxxxx…");
    expect(plainSummary(null)).toBe("");
  });
});
