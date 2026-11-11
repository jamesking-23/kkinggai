/** Fetchers for public game archives. Both take an injectable fetch so they can be tested without the network. */

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;

export class SourceError extends Error {}

const USERNAME = /^[A-Za-z0-9_-]{2,30}$/;
const MAX_BYTES = 5_000_000;
const UA = "KKINGG-AI personal app (contact: owner)";

async function get(f: FetchLike, url: string, accept: string) {
  let res;
  try {
    res = await f(url, {
      headers: { accept, "user-agent": UA },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new SourceError("Could not reach the service. Try again later.");
  }
  if (res.status === 404) throw new SourceError("That username was not found.");
  if (res.status === 429)
    throw new SourceError("The service is rate limiting requests. Try again in a few minutes.");
  if (!res.ok) throw new SourceError(`The service returned an error (${res.status}).`);
  return res;
}

function checkUsername(u: string) {
  if (!USERNAME.test(u)) throw new SourceError("Invalid username.");
}

/** Latest games for a Lichess user, as PGN text. */
export async function fetchLichessPgn(username: string, f: FetchLike, max = 100): Promise<string> {
  checkUsername(username);
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&opening=true&clocks=false&evals=false`;
  const text = await (await get(f, url, "application/x-chess-pgn")).text();
  if (text.length > MAX_BYTES) throw new SourceError("The response was too large.");
  return text;
}

/** Latest games for a Chess.com user from their most recent monthly archives, as PGN text. */
export async function fetchChesscomPgn(
  username: string,
  f: FetchLike,
  months = 2,
  maxGames = 100,
): Promise<string> {
  checkUsername(username);
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`;
  const idx = (await (await get(f, `${base}/games/archives`, "application/json")).json()) as {
    archives?: unknown;
  };
  const archives = Array.isArray(idx.archives)
    ? idx.archives.filter((a): a is string => typeof a === "string")
    : [];
  // Only follow archive links that stay on this user's Chess.com path.
  const safe = archives
    .filter((a) => a.startsWith(`${base}/games/`))
    .slice(-months)
    .reverse();
  const pgns: string[] = [];
  for (const url of safe) {
    const month = (await (await get(f, url, "application/json")).json()) as {
      games?: { pgn?: unknown }[];
    };
    for (const g of [...(month.games ?? [])].reverse()) {
      if (typeof g.pgn === "string" && g.pgn.trim()) pgns.push(g.pgn.trim());
      if (pgns.length >= maxGames) break;
    }
    if (pgns.length >= maxGames) break;
  }
  const text = pgns.join("\n\n");
  if (text.length > MAX_BYTES) throw new SourceError("The response was too large.");
  return text;
}
