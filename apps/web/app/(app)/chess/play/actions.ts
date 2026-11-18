"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flash } from "../../../../lib/form";
import { INVITE_CODE, isLegalNext, replayMoves, sideOf } from "../../../../lib/mp";
import { createClient } from "../../../../lib/supabase/server";

const PLAY = "/chess/play";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuid = {
  safeParse: (v: FormDataEntryValue | null) => {
    const data = typeof v === "string" ? v : "";
    return UUID.test(data)
      ? { success: true as const, data }
      : { success: false as const, data: undefined };
  },
};
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Database errors are written for people (see the mp_* functions), so they are shown as they are. */
const reason = (e: { message: string }) => e.message.slice(0, 200);

export async function createGame(formData: FormData) {
  const pick = String(formData.get("color") ?? "random");
  const color =
    pick === "white" || pick === "black" ? pick : randomInt(2) === 0 ? "white" : "black";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mp_create", { color });
  if (error || !data?.[0])
    flash(PLAY, "error", error ? reason(error) : "Could not create the game");
  revalidatePath(PLAY);
  redirect(`${PLAY}/${data[0]!.id}`);
}

export async function joinGame(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  if (!INVITE_CODE.test(code)) flash(PLAY, "error", "This invite link is not valid");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mp_join", { code });
  if (error || !data) flash(PLAY, "error", error ? reason(error) : "Could not join the game");
  revalidatePath(PLAY);
  redirect(`${PLAY}/${data}`);
}

/** Checks the move with chess.js against the stored game, then records it. See mp_move for what the database enforces. */
export async function playMove(formData: FormData) {
  const id = uuid.safeParse(formData.get("id"));
  const uci = String(formData.get("uci") ?? "");
  if (!id.success || !UCI.test(uci)) flash(PLAY, "error", "Invalid move");
  const path = `${PLAY}/${id.data}`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: g } = await supabase
    .from("mp_games")
    .select("status, moves, white_id, black_id, resigned_by")
    .eq("id", id.data!)
    .maybeSingle();
  if (!g || g.status !== "active") flash(path, "error", "This game is not in progress");
  const side = sideOf(g, auth.user?.id ?? null);
  const rep = replayMoves(g.moves);
  if (!side || !rep.ok || rep.over) flash(path, "error", "This game is not in progress");
  if ((rep.turn === "w") !== (side === "white")) flash(path, "error", "It is not your turn");
  if (!isLegalNext(g.moves, uci)) flash(path, "error", "That move is not legal");
  const { error } = await supabase.rpc("mp_move", {
    game: id.data!,
    expected_ply: g.moves.length,
    uci,
  });
  if (error) flash(path, "error", reason(error));
  revalidatePath(path);
  redirect(path);
}

export async function resignGame(formData: FormData) {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) flash(PLAY, "error", "Invalid game");
  const path = `${PLAY}/${id.data}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_resign", { game: id.data! });
  if (error) flash(path, "error", reason(error));
  revalidatePath(path);
  redirect(path);
}

export async function drawAction(formData: FormData) {
  const id = uuid.safeParse(formData.get("id"));
  const action = String(formData.get("action") ?? "");
  if (!id.success || !["offer", "accept", "decline"].includes(action))
    flash(PLAY, "error", "Invalid request");
  const path = `${PLAY}/${id.data}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_draw", { game: id.data!, action });
  if (error) flash(path, "error", reason(error));
  revalidatePath(path);
  redirect(path);
}

export async function rematchGame(formData: FormData) {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) flash(PLAY, "error", "Invalid game");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mp_rematch", { game: id.data! });
  if (error || !data)
    flash(`${PLAY}/${id.data}`, "error", error ? reason(error) : "Could not offer a rematch");
  revalidatePath(PLAY);
  redirect(`${PLAY}/${data}`);
}

export async function acceptInvite(formData: FormData) {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) flash(PLAY, "error", "Invalid game");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_accept", { game: id.data! });
  if (error) flash(PLAY, "error", reason(error));
  revalidatePath(PLAY);
  redirect(`${PLAY}/${id.data}`);
}

export async function declineInvite(formData: FormData) {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) flash(PLAY, "error", "Invalid game");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_decline", { game: id.data! });
  if (error) flash(PLAY, "error", reason(error));
  revalidatePath(PLAY);
  flash(PLAY, "message", "Invitation declined");
}
