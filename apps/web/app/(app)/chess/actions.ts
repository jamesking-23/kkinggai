"use server";

import { revalidatePath } from "next/cache";
import {
  CHESS_MAX_GAMES_PER_IMPORT,
  CHESS_MAX_PGN_CHARS,
  chessImportSchema,
  chessNotesSchema,
  chessProfileSchema,
} from "@kkingg/schemas";
import { detectColor, parsePgnGames } from "../../../lib/chess";
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

export async function importPgn(formData: FormData) {
  const file = formData.get("file");
  let text = String(formData.get("pgn") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > CHESS_MAX_PGN_CHARS) flash(PATH, "error", "That file is larger than 1 MB");
    text = await file.text();
  }
  const parsed = chessImportSchema.safeParse({ pgn: text });
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));

  const out = parsePgnGames(parsed.data.pgn, CHESS_MAX_GAMES_PER_IMPORT);
  if (out.games.length === 0) {
    flash(PATH, "error", out.errors[0] ?? "No valid games found");
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
    .eq("source", "pgn")
    .is("deleted_at", null)
    .in("external_id", keys);
  const have = new Set((existing ?? []).map((r) => r.external_id));
  const fresh = out.games.filter((g) => !have.has(g.externalId));

  if (fresh.length > 0) {
    const { error } = await supabase.from("chess_games").insert(
      fresh.map((g) => ({
        source: "pgn",
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
  const parts = [`Imported ${fresh.length} game${fresh.length === 1 ? "" : "s"}`];
  const dupes = out.games.length - fresh.length;
  if (dupes) parts.push(`${dupes} already in your history`);
  if (out.errors.length) parts.push(`${out.errors.length} skipped (${out.errors[0]})`);
  if (out.truncated) parts.push(`only the first ${CHESS_MAX_GAMES_PER_IMPORT} were read`);
  flash(PATH, "message", parts.join(" · ").slice(0, 300));
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
