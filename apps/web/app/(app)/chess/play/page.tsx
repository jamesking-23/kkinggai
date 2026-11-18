import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import { replayMoves, summarise } from "../../../../lib/mp";
import type { FlashParams } from "../../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../../components/ui";
import { acceptInvite, createGame, declineInvite } from "./actions";

export default async function PlayPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "chess");
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const { data: games } = await supabase
    .from("mp_games")
    .select(
      "id, status, moves, white_id, black_id, white_name, black_name, resigned_by, invited_id, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href="/chess" className="text-primary">
          ← Chess
        </a>
      </p>
      <PageHeader
        title="Play a friend"
        subtitle="Create a game, send the invite link, and play move by move."
      />
      <Flash error={error} message={message} />

      <Card>
        <form action={createGame} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Play as</span>
            <select name="color" defaultValue="random" className={inputClass}>
              <option value="random">Random</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </label>
          <button className={primaryButton}>New game</button>
        </form>
      </Card>

      <h2 className="mb-2 mt-6 text-lg font-semibold">Your games</h2>
      {games?.length ? (
        <ul className="space-y-2">
          {games.map((g) => {
            if (g.invited_id === ctx.userId && g.status === "waiting") {
              const from = g.white_id ? g.white_name : g.black_name;
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                >
                  <span>
                    {from ?? "Someone"} invited you to a rematch (you play{" "}
                    {g.white_id ? "black" : "white"})
                  </span>
                  <span className="flex gap-2">
                    <form action={acceptInvite}>
                      <input type="hidden" name="id" value={g.id} />
                      <button className={primaryButton}>Accept</button>
                    </form>
                    <form action={declineInvite}>
                      <input type="hidden" name="id" value={g.id} />
                      <button className={subtleButton}>Decline</button>
                    </form>
                  </span>
                </li>
              );
            }
            const mineWhite = g.white_id === ctx.userId;
            const opp = mineWhite ? g.black_name : g.white_name;
            const s = summarise(g, replayMoves(g.moves));
            return (
              <li key={g.id}>
                <a
                  href={`/chess/play/${g.id}`}
                  className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-surface"
                >
                  <span>
                    vs {opp ?? "(waiting)"} · you are {mineWhite ? "white" : "black"}
                  </span>
                  <span className={s.finished ? "text-muted" : ""}>{s.text}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No games yet. Create one and share the link.</Empty>
      )}
    </div>
  );
}
