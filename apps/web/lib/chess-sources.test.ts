import { describe, expect, it } from "vitest";
import { fetchChesscomPgn, fetchLichessPgn, SourceError, type FetchLike } from "./chess-sources";

const reply = (status: number, body: unknown): FetchLike => {
  const calls: string[] = [];
  const f: FetchLike & { calls: string[] } = Object.assign(
    async (url: string) => {
      calls.push(url);
      const b = typeof body === "function" ? (body as (u: string) => unknown)(url) : body;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => String(b),
        json: async () => b,
      };
    },
    { calls },
  );
  return f;
};

describe("fetchLichessPgn", () => {
  it("requests the games endpoint and returns the PGN text", async () => {
    const f = reply(200, "[Event x]\n\n1. e4 *");
    expect(await fetchLichessPgn("some_user", f, 10)).toContain("1. e4");
    expect((f as unknown as { calls: string[] }).calls[0]).toBe(
      "https://lichess.org/api/games/user/some_user?max=10&opening=true&clocks=false&evals=false",
    );
  });
  it("maps errors to readable messages", async () => {
    await expect(fetchLichessPgn("nobody_x", reply(404, ""))).rejects.toThrow("not found");
    await expect(fetchLichessPgn("nobody_x", reply(429, ""))).rejects.toThrow("rate limiting");
    await expect(fetchLichessPgn("nobody_x", reply(500, ""))).rejects.toBeInstanceOf(SourceError);
  });
  it("rejects bad usernames before any request", async () => {
    const f = reply(200, "");
    await expect(fetchLichessPgn("../etc", f)).rejects.toThrow("Invalid username");
    expect((f as unknown as { calls: string[] }).calls).toHaveLength(0);
  });
  it("turns network failures into a SourceError", async () => {
    const f: FetchLike = async () => {
      throw new Error("boom");
    };
    await expect(fetchLichessPgn("some_user", f)).rejects.toThrow("Could not reach");
  });
});

describe("fetchChesscomPgn", () => {
  const base = "https://api.chess.com/pub/player/some_user";
  const data = (url: string) =>
    url.endsWith("/archives")
      ? {
          archives: [
            `${base}/games/2026/08`,
            `${base}/games/2026/09`,
            `${base}/games/2026/10`,
            "https://evil.example/x",
          ],
        }
      : {
          games: [
            { pgn: `[Event "a"]\n\n1. e4 e5 *` },
            { pgn: `[Event "b"]\n\n1. d4 d5 *` },
            { nopgn: true },
          ],
        };

  it("follows only the latest archives on the user's own path", async () => {
    const f = reply(200, data);
    const text = await fetchChesscomPgn("Some_User", f, 2);
    const calls = (f as unknown as { calls: string[] }).calls;
    expect(calls).toEqual(
      [`${base}/games/archives`, `${base}/games/2026/10`, `${base}/games/2026/09`].slice(0, 3),
    );
    expect(text.split('[Event "').length - 1).toBe(4);
  });
  it("respects the game cap", async () => {
    const text = await fetchChesscomPgn("some_user", reply(200, data), 2, 3);
    expect(text.split('[Event "').length - 1).toBe(3);
  });
  it("handles an empty archive list", async () => {
    expect(await fetchChesscomPgn("some_user", reply(200, { archives: [] }))).toBe("");
  });
});
