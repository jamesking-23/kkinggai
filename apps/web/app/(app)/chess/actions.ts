"use server";

import { revalidatePath } from "next/cache";
import {
  CHESS_MAX_GAMES_PER_IMPORT,
  CHESS_MAX_PGN_CHARS,
  CHESS_PUZZLE_MIN_LOSS,
  chessPuzzleAttemptSchema,
  chessPuzzleSaveSchema,
  chessImportSchema,
  chessNotesSchema,
  chessProfileSchema,
} from "@kkingg/schemas";
import { detectColor, parsePgnGames, replay } from "../../../lib/chess";
import { nextSchedule, sanForUci } from "../../../lib/puzzles";
import { fetchChesscomPgn, fetchLichessPgn, SourceError } from "../../../lib/chess-sources";
import { firstIssue, flash } from "../../../lib/form";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/chess";
const STALE = "This game was changed elsewhere. Reload and try again.";

export async function saveChessProfile(formData: FormData) {
  const parsed = chessProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const p = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("chess_profiles").upsert({
    user_id: ctx.userId,
    player_names: p.playerNames,
    lichess_username: p.lichessUsername ?? null,
    chesscom_username: p.chesscomUsername ?? null,
  });
  if (error) flash(PATH, "error", "Could not save your chess profile");
  revalidatePath(PATH);
  flash(PATH, "message", "Chess profile saved");
}

type Source = "pgn" | "lichess" | "chesscom";

/** Parses PGN text, skips games already saved for this source, inserts the rest and redirects with a summary. */
async function saveGames(source: Source, text: string, label: string): Promise<never> {
  const out = parsePgnGames(text, CHESS_MAX_GAMES_PER_IMPORT);
  if (out.games.length === 0) {
    flash(
      PATH,
      "error",
      out.errors[0] ?? `No games found${source === "pgn" ? "" : " for that account"}`,
    );
  }

  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("chess_profiles")
    .select("player_names, lichess_username, chesscom_username")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const names = [
    ...(profile?.player_names ?? []),
    ...(profile?.lichess_username ? [profile.lichess_username] : []),
    ...(profile?.chesscom_username ? [profile.chesscom_username] : []),
  ];

  const keys = out.games.map((g) => g.externalId);
  const { data: existing } = await supabase
    .from("chess_games")
    .select("external_id")
    .eq("source", source)
    .is("deleted_at", null)
    .in("external_id", keys);
  const have = new Set((existing ?? []).map((r) => r.external_id));
  const fresh = out.games.filter((g) => !have.has(g.externalId));

  if (fresh.length > 0) {
    const { error } = await supabase.from("chess_games").insert(
      fresh.map((g) => ({
        source,
        external_id: g.externalId,
        white: g.white,
        black: g.black,
        user_color: detectColor(g.white, g.black, names),
        result: g.result,
        event: g.event,
        site: g.site,
        played_on: g.playedOn,
        time_control: g.timeControl,
        white_elo: g.whiteElo,
        black_elo: g.blackElo,
        eco: g.eco,
        opening: g.opening,
        termination: g.termination,
        move_count: g.moveCount,
        pgn: g.pgn,
      })),
    );
    if (error) flash(PATH, "error", "Could not save the games");
  }

  revalidatePath(PATH);
  const parts = [`${label} ${fresh.length} game${fresh.length === 1 ? "" : "s"}`];
  const dupes = out.games.length - fresh.length;
  if (dupes) parts.push(`${dupes} already in your history`);
  if (out.errors.length) parts.push(`${out.errors.length} skipped (${out.errors[0]})`);
  if (out.truncated) parts.push(`only the first ${CHESS_MAX_GAMES_PER_IMPORT} were read`);
  flash(PATH, "message", parts.join(" · ").slice(0, 300));
}

export async function importPgn(formData: FormData) {
  const file = formData.get("file");
  let text = String(formData.get("pgn") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > CHESS_MAX_PGN_CHARS) flash(PATH, "error", "That file is larger than 1 MB");
    text = await file.text();
  }
  const parsed = chessImportSchema.safeParse({ pgn: text });
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  await saveGames("pgn", parsed.data.pgn, "Imported");
}

/** Pulls recent games for the username saved on the profile (never one typed into the form). */
async function sync(source: "lichess" | "chesscom") {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("chess_profiles")
    .select("lichess_username, chesscom_username")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const username = source === "lichess" ? profile?.lichess_username : profile?.chesscom_username;
  if (!username) flash(PATH, "error", "Save your username first");
  let text: string;
  try {
    text =
      source === "lichess"
        ? await fetchLichessPgn(username!, fetch)
        : await fetchChesscomPgn(username!, fetch);
  } catch (e) {
    flash(PATH, "error", e instanceof SourceError ? e.message : "Could not fetch games");
  }
  await saveGames(source, text, "Synced");
}

export async function syncLichess() {
  await sync("lichess");
}

export async function syncChesscom() {
  await sync("chesscom");
}

export async function saveGameNotes(formData: FormData) {
  const parsed = chessNotesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const revision = Number(formData.get("revision"));
  const path = `${PATH}/${parsed.data.id}`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chess_games")
    .update({ notes: parsed.data.notes, tags: parsed.data.tags })
    .eq("id", parsed.data.id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(path, "error", "Could not save the notes");
  if (!data || data.length === 0) flash(path, "error", STALE);
  revalidatePath(path);
  flash(path, "message", "Notes saved");
}

export async function deleteGame(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chess_games")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the game");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Game removed");
}

export type SavePuzzlesResult =
  { ok: true; saved: number; skipped: number } | { ok: false; error: string };

/**
 * Saves engine-found mistakes as puzzles. The position and the played move are taken from the stored game, never from the
 * client; the client only supplies the engine's suggestion, which must be a legal, different move for the user's own side.
 */
export async function savePuzzles(input: unknown): Promise<SavePuzzlesResult> {
  const parsed = chessPuzzleSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { gameId, items } = parsed.data;
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("chess_games")
    .select("pgn, user_color")
    .eq("id", gameId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!game) return { ok: false, error: "Game not found" };
  if (!game.user_color)
    return { ok: false, error: "Save your player names first so your side is known" };
  const played = replay(game.pgn);
  if (!played) return { ok: false, error: "This game could not be replayed" };

  const rows: {
    game_id: string;
    ply: number;
    fen: string;
    side_to_move: string;
    solution_uci: string;
    played_uci: string;
    loss_cp: number;
    depth: number;
  }[] = [];
  for (const it of items) {
    const mine = (it.ply % 2 === 1 ? "white" : "black") === game.user_color;
    const fen = played.fens[it.ply - 1];
    const playedUci = played.ucis[it.ply - 1];
    if (!mine || !fen || !playedUci || it.loss < CHESS_PUZZLE_MIN_LOSS) continue;
    if (it.best === playedUci || !sanForUci(fen, it.best)) continue;
    rows.push({
      game_id: gameId,
      ply: it.ply,
      fen,
      side_to_move: game.user_color,
      solution_uci: it.best,
      played_uci: playedUci,
      loss_cp: it.loss,
      depth: it.depth,
    });
  }
  if (rows.length === 0) return { ok: true, saved: 0, skipped: items.length };

  const { data: have } = await supabase
    .from("chess_puzzles")
    .select("ply")
    .eq("game_id", gameId)
    .is("deleted_at", null);
  const taken = new Set((have ?? []).map((r) => r.ply));
  const fresh = rows.filter((r) => !taken.has(r.ply));
  if (fresh.length > 0) {
    const { error } = await supabase.from("chess_puzzles").insert(fresh);
    if (error) return { ok: false, error: "Could not save the puzzles" };
  }
  revalidatePath("/chess/train");
  return { ok: true, saved: fresh.length, skipped: items.length - fresh.length };
}

const TRAIN = "/chess/train";

export async function recordPuzzleAttempt(formData: FormData) {
  const parsed = chessPuzzleAttemptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(TRAIN, "error", "Invalid attempt");
  const { id, revision, move } = parsed.data;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("chess_puzzles")
    .select("fen, solution_uci, box, attempts, correct, revision")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!p) flash(TRAIN, "error", "Puzzle not found");
  if (p!.revision !== revision) flash(TRAIN, "error", STALE);
  const correct = move === p!.solution_uci;
  const sched = nextSchedule(p!.box, correct, new Date());
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("chess_puzzles")
    .update({
      box: sched.box,
      next_due_at: sched.dueAt.toISOString(),
      attempts: p!.attempts + 1,
      correct: p!.correct + (correct ? 1 : 0),
      last_attempt_at: now,
    })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(TRAIN, "error", "Could not record the attempt");
  if (!data || data.length === 0) flash(TRAIN, "error", STALE);
  revalidatePath(TRAIN);
  revalidatePath(PATH);
  const san = sanForUci(p!.fen, p!.solution_uci) ?? p!.solution_uci;
  flash(TRAIN, "message", correct ? "Correct" : `Not quite. The engine's move was ${san}`);
}
