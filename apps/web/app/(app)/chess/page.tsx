import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import { computeStats, outcomeFor, winRate, type Record3 } from "../../../lib/chess";
import type { FlashParams } from "../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../components/ui";
import { importPgn, saveChessProfile, syncChesscom, syncLichess } from "./actions";

const fmtRecord = (r: Record3) =>
  r.games ? `${r.wins}W ${r.draws}D ${r.losses}L · ${winRate(r)}%` : "No games yet";

export default async function ChessPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "chess");
  const { error, message } = await searchParams;
  const supabase = await createClient();

  const [{ data: games }, { data: profile }, { count: dueCount }] = await Promise.all([
    supabase
      .from("chess_games")
      .select(
        "id, white, black, result, user_color, opening, played_on, white_elo, black_elo, move_count, time_control, created_at",
      )
      .is("deleted_at", null)
      .order("played_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("chess_profiles")
      .select("player_names, lichess_username, chesscom_username")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    supabase
      .from("chess_puzzles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .lte("next_due_at", new Date().toISOString()),
  ]);
  const list = games ?? [];
  const stats = computeStats(list);
  const unknownColor = list.filter((g) => !g.user_color).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Chess" subtitle="Your game history, imported from PGN." />
      <Flash error={error} message={message} />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card title="Overall">
          <p className="text-sm">{fmtRecord(stats.overall)}</p>
          <p className="mt-1 text-xs text-muted">
            {stats.counted} of {stats.total} games counted
          </p>
        </Card>
        <Card title="As white">
          <p className="text-sm">{fmtRecord(stats.white)}</p>
        </Card>
        <Card title="As black">
          <p className="text-sm">{fmtRecord(stats.black)}</p>
        </Card>
      </div>

      <p className="mb-6 text-sm">
        <a href="/chess/train" className="text-primary">
          Train on your mistakes{dueCount ? ` (${dueCount} due)` : ""}
        </a>
      </p>

      {(profile?.lichess_username || profile?.chesscom_username) && (
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          {profile?.lichess_username && (
            <form action={syncLichess}>
              <button type="submit" className={subtleButton}>
                Sync Lichess ({profile.lichess_username})
              </button>
            </form>
          )}
          {profile?.chesscom_username && (
            <form action={syncChesscom}>
              <button type="submit" className={subtleButton}>
                Sync Chess.com ({profile.chesscom_username})
              </button>
            </form>
          )}
          <span className="text-xs text-muted">Fetches up to 100 recent public games.</span>
        </div>
      )}

      {unknownColor > 0 && (
        <p className="mb-6 rounded-md border border-border bg-surface p-3 text-sm text-muted">
          {unknownColor} game{unknownColor === 1 ? "" : "s"} can&apos;t be scored because your side
          is unknown. Save your player names below, then re-import those games.
        </p>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card title="Import games">
          <form action={importPgn} className="space-y-2">
            <textarea
              name="pgn"
              rows={6}
              placeholder="Paste one or more games in PGN format"
              aria-label="PGN text"
              className={`${inputClass} font-mono text-xs`}
            />
            <input
              type="file"
              name="file"
              accept=".pgn,text/plain"
              aria-label="PGN file"
              className="text-sm"
            />
            <p className="text-xs text-muted">
              Up to 200 games or 1 MB per import. Games already in your history are skipped, and
              illegal games are reported rather than saved.
            </p>
            <button type="submit" className={primaryButton}>
              Import
            </button>
          </form>
        </Card>
        <Card title="Your names">
          <form action={saveChessProfile} className="space-y-2">
            <input
              name="playerNames"
              defaultValue={(profile?.player_names ?? []).join(", ")}
              placeholder="Names you play under, comma separated"
              aria-label="Player names"
              className={inputClass}
            />
            <input
              name="lichessUsername"
              defaultValue={profile?.lichess_username ?? ""}
              placeholder="Lichess username (optional)"
              aria-label="Lichess username"
              className={inputClass}
            />
            <input
              name="chesscomUsername"
              defaultValue={profile?.chesscom_username ?? ""}
              placeholder="Chess.com username (optional)"
              aria-label="Chess.com username"
              className={inputClass}
            />
            <p className="text-xs text-muted">
              Used to work out which side you played. Saving a username lets you sync that account's
              public games. No password or login is used.
            </p>
            <button type="submit" className={subtleButton}>
              Save
            </button>
          </form>
        </Card>
      </div>

      {stats.openings.length > 0 && (
        <Card title="Openings" className="mb-6">
          <ul className="space-y-1 text-sm">
            {stats.openings.map((o) => (
              <li key={o.name} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{o.name}</span>
                <span className="shrink-0 text-muted">
                  {o.games} · {fmtRecord(o)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {stats.ratings.length > 1 && (
        <Card title="Rating" className="mb-6">
          <p className="text-sm">
            {stats.ratings[0]!.rating} on {stats.ratings[0]!.date} → {stats.ratings.at(-1)!.rating}{" "}
            on {stats.ratings.at(-1)!.date}
          </p>
          <p className="mt-1 text-xs text-muted">From ratings recorded in your imported PGNs.</p>
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">History ({list.length})</h2>
        {list.length > 0 && (
          <a href="/chess/export" className={subtleButton}>
            Export PGN
          </a>
        )}
      </div>
      {list.length ? (
        <ul className="space-y-2">
          {list.slice(0, 200).map((g) => {
            const o = outcomeFor(g);
            return (
              <li key={g.id}>
                <a
                  href={`/chess/${g.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm hover:bg-bg"
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      {g.white} vs {g.black}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {g.played_on ?? "No date"} · {g.move_count} moves
                      {g.opening ? ` · ${g.opening}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs">
                    {g.result}
                    {o ? ` · ${o}` : ""}
                  </span>
                </a>
              </li>
            );
          })}
          {list.length > 200 && <li className="text-xs text-muted">Showing the latest 200.</li>}
        </ul>
      ) : (
        <Empty>No games yet. Paste a PGN above to start.</Empty>
      )}
    </div>
  );
}
