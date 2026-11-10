import { exportPgn } from "../../../../lib/chess";
import { createClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

/** Downloads the signed-in user's non-deleted games as one PGN file. RLS limits rows to their own. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { data, error } = await supabase
    .from("chess_games")
    .select("pgn")
    .is("deleted_at", null)
    .order("played_on", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) return new Response("Could not export games", { status: 500 });
  return new Response(exportPgn(data ?? []), {
    headers: {
      "content-type": "application/x-chess-pgn; charset=utf-8",
      "content-disposition": 'attachment; filename="kkingg-games.pgn"',
      "cache-control": "no-store",
    },
  });
}
