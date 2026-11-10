import { createHash } from "node:crypto";
import { Chess } from "chess.js";
import { classifyOpening } from "./openings";

export type ChessResult = "1-0" | "0-1" | "1/2-1/2" | "*";
export type Color = "white" | "black";

export type ParsedGame = {
  white: string;
  black: string;
  result: ChessResult;
  event: string | null;
  site: string | null;
  playedOn: string | null;
  timeControl: string | null;
  whiteElo: number | null;
  blackElo: number | null;
  eco: string | null;
  opening: string | null;
  termination: string | null;
  moveCount: number;
  pgn: string;
  /** Stable key used to skip games that were already imported. */
  externalId: string;
};

export const MAX_GAME_PGN_CHARS = 200_000;

/** Splits a multi-game PGN on "[Event" tags. Text with no tags is treated as a single game. */
export function splitPgn(text: string): string[] {
  const normalised = text
    .replace(new RegExp("^" + String.fromCharCode(0xfeff)), "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!normalised) return [];
  return normalised
    .split(/^(?=\[Event\s)/m)
    .map((g) => g.trim())
    .filter(Boolean);
}

function header(h: Record<string, string | null>, key: string, max: number): string | null {
  const v = h[key]?.trim();
  if (!v || v === "?" || v === "-") return null;
  return v.slice(0, max);
}

function normaliseDate(v: string | null): string | null {
  const m = v?.match(/^(\d{4})[.-](\d{2})[.-](\d{2})$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

function normaliseResult(v: string | null | undefined): ChessResult {
  const t = v?.trim();
  if (t === "1-0" || t === "0-1" || t === "1/2-1/2") return t;
  if (t === "½-½") return "1/2-1/2";
  return "*";
}

function elo(v: string | null): number | null {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isInteger(n) && n > 0 && n <= 4000 ? n : null;
}

export function parsePgnGame(
  text: string,
): { ok: true; game: ParsedGame } | { ok: false; error: string } {
  if (text.length > MAX_GAME_PGN_CHARS) return { ok: false, error: "Game is too large" };
  const chess = new Chess();
  try {
    chess.loadPgn(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid PGN" };
  }
  const h = chess.header() as Record<string, string | null>;
  const sans = chess.history();
  if (sans.length === 0) return { ok: false, error: "No moves found" };

  const white = header(h, "White", 100) ?? "?";
  const black = header(h, "Black", 100) ?? "?";
  const playedOn = normaliseDate(h.UTCDate ?? h.Date ?? null) ?? normaliseDate(h.Date ?? null);
  const ecoRaw = header(h, "ECO", 3);
  const known = classifyOpening(sans);
  const hasEco = ecoRaw && /^[A-E]\d\d$/.test(ecoRaw);
  const result = normaliseResult(h.Result ?? text.trim().split(/\s+/).pop());
  const key = createHash("sha1")
    .update(`${white}|${black}|${playedOn ?? ""}|${sans.join(" ")}`)
    .digest("hex");

  return {
    ok: true,
    game: {
      white,
      black,
      result,
      event: header(h, "Event", 200),
      site: header(h, "Site", 200),
      playedOn,
      timeControl: header(h, "TimeControl", 40),
      whiteElo: elo(h.WhiteElo ?? null),
      blackElo: elo(h.BlackElo ?? null),
      eco: hasEco ? ecoRaw : (known?.eco ?? null),
      opening: header(h, "Opening", 200) ?? known?.name ?? null,
      termination: header(h, "Termination", 100),
      moveCount: Math.ceil(sans.length / 2),
      pgn: text.trim(),
      externalId: key,
    },
  };
}

export type ParseOutcome = { games: ParsedGame[]; errors: string[]; truncated: boolean };

export function parsePgnGames(text: string, limit: number): ParseOutcome {
  const chunks = splitPgn(text);
  const games: ParsedGame[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  chunks.slice(0, limit).forEach((chunk, i) => {
    const r = parsePgnGame(chunk);
    if (!r.ok) errors.push(`Game ${i + 1}: ${r.error.split("\n")[0]}`);
    else if (!seen.has(r.game.externalId)) {
      seen.add(r.game.externalId);
      games.push(r.game);
    }
  });
  return { games, errors, truncated: chunks.length > limit };
}

/** Which colour the user played, from the names they have saved. Null when unknown or ambiguous. */
export function detectColor(white: string, black: string, names: string[]): Color | null {
  const set = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean));
  const w = set.has(white.trim().toLowerCase());
  const b = set.has(black.trim().toLowerCase());
  if (w === b) return null;
  return w ? "white" : "black";
}

/** SAN list and a FEN for every position (index 0 is the starting position). Null if the PGN is invalid. */
export function replay(pgn: string): { sans: string[]; fens: string[] } | null {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }
  const verbose = chess.history({ verbose: true });
  const start = verbose[0]?.before ?? new Chess().fen();
  return { sans: verbose.map((m) => m.san), fens: [start, ...verbose.map((m) => m.after)] };
}

export type StatGame = {
  result: string;
  user_color: string | null;
  opening: string | null;
  played_on: string | null;
  white_elo: number | null;
  black_elo: number | null;
};

export type Outcome = "win" | "draw" | "loss";

export function outcomeFor(g: Pick<StatGame, "result" | "user_color">): Outcome | null {
  if (!g.user_color || g.result === "*") return null;
  if (g.result === "1/2-1/2") return "draw";
  const whiteWon = g.result === "1-0";
  return (g.user_color === "white") === whiteWon ? "win" : "loss";
}

export type Record3 = { games: number; wins: number; draws: number; losses: number };
const empty = (): Record3 => ({ games: 0, wins: 0, draws: 0, losses: 0 });
function add(r: Record3, o: Outcome) {
  r.games++;
  if (o === "win") r.wins++;
  else if (o === "draw") r.draws++;
  else r.losses++;
}

export function winRate(r: Record3): number | null {
  return r.games ? Math.round(((r.wins + r.draws / 2) / r.games) * 100) : null;
}

export type ChessStats = {
  total: number;
  /** Games with a known colour and a finished result. */
  counted: number;
  overall: Record3;
  white: Record3;
  black: Record3;
  openings: (Record3 & { name: string })[];
  months: (Record3 & { month: string })[];
  ratings: { date: string; rating: number }[];
};

export function computeStats(games: StatGame[], topOpenings = 8): ChessStats {
  const overall = empty();
  const white = empty();
  const black = empty();
  const openings = new Map<string, Record3>();
  const months = new Map<string, Record3>();
  const ratings: { date: string; rating: number }[] = [];

  for (const g of games) {
    const o = outcomeFor(g);
    if (!o) continue;
    add(overall, o);
    add(g.user_color === "white" ? white : black, o);
    const name = g.opening ?? "Unknown";
    add(openings.get(name) ?? openings.set(name, empty()).get(name)!, o);
    if (g.played_on) {
      const m = g.played_on.slice(0, 7);
      add(months.get(m) ?? months.set(m, empty()).get(m)!, o);
    }
  }
  for (const g of games) {
    const rating =
      g.user_color === "white" ? g.white_elo : g.user_color === "black" ? g.black_elo : null;
    if (g.played_on && rating) ratings.push({ date: g.played_on, rating });
  }
  ratings.sort((a, b) => a.date.localeCompare(b.date));

  return {
    total: games.length,
    counted: overall.games,
    overall,
    white,
    black,
    openings: [...openings.entries()]
      .map(([name, r]) => ({ name, ...r }))
      .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
      .slice(0, topOpenings),
    months: [...months.entries()]
      .map(([month, r]) => ({ month, ...r }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    ratings,
  };
}

/** Joins stored PGNs into one downloadable file. */
export function exportPgn(games: { pgn: string }[]): string {
  return games.map((g) => g.pgn.trim()).join("\n\n") + "\n";
}
