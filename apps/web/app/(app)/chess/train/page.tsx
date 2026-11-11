import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import { sanForUci } from "../../../../lib/puzzles";
import type { FlashParams } from "../../../../lib/form";
import { PuzzleBoard } from "../../../../components/puzzle-board";
import { Card, Empty, Flash, PageHeader } from "../../../../components/ui";

export default async function ChessTrainPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "chess");
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: due }, { count: total }, { count: dueCount }] = await Promise.all([
    supabase
      .from("chess_puzzles")
      .select(
        "id, game_id, fen, side_to_move, solution_uci, played_uci, loss_cp, revision, attempts, correct",
      )
      .is("deleted_at", null)
      .lte("next_due_at", nowIso)
      .order("next_due_at", { ascending: true })
      .limit(1),
    supabase
      .from("chess_puzzles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("chess_puzzles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .lte("next_due_at", nowIso),
  ]);
  const p = due?.[0];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href="/chess" className="text-primary">
          ← Chess
        </a>
      </p>
      <PageHeader
        title="Train on your mistakes"
        subtitle={`${dueCount ?? 0} due · ${total ?? 0} saved`}
      />
      <Flash error={error} message={message} />

      {p ? (
        <Card>
          <PuzzleBoard
            id={p.id}
            revision={p.revision}
            fen={p.fen}
            solutionUci={p.solution_uci}
            side={p.side_to_move === "black" ? "black" : "white"}
          />
          <p className="mt-4 text-xs text-muted">
            In this position you played {sanForUci(p.fen, p.played_uci) ?? p.played_uci}, about{" "}
            {p.loss_cp} centipawns worse than the engine&apos;s choice.{" "}
            {p.attempts > 0 ? `Solved ${p.correct} of ${p.attempts} tries. ` : ""}
            <a href={`/chess/${p.game_id}`} className="text-primary">
              Open the game
            </a>
          </p>
        </Card>
      ) : (
        <Empty>
          {total
            ? "Nothing due right now. Come back later."
            : "No puzzles yet. Open a game, run the analysis, then save its mistakes as puzzles."}
        </Empty>
      )}
      <p className="mt-4 text-xs text-muted">
        Only the engine&apos;s top move counts as correct, so a different good move is marked wrong.
        Puzzles come from a lite Stockfish at the depth you chose, and a position can have more than
        one good answer.
      </p>
    </div>
  );
}
