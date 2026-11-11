import { notFound } from "next/navigation";
import { requireModule } from "../../../../lib/modules";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import { outcomeFor, replay } from "../../../../lib/chess";
import type { FlashParams } from "../../../../lib/form";
import { ChessBoard } from "../../../../components/chess-board";
import {
  Card,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../../components/ui";
import { deleteGame, saveGameNotes } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ChessGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "chess");
  const { id } = await params;
  const { error, message } = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: g } = await supabase
    .from("chess_games")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!g) notFound();

  const played = replay(g.pgn);
  const o = outcomeFor(g);
  const facts = [
    g.event,
    g.played_on,
    g.time_control && `TC ${g.time_control}`,
    g.opening && `${g.opening}${g.eco ? ` (${g.eco})` : ""}`,
    g.termination,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-2 text-sm">
        <a href="/chess" className="text-primary">
          ← Chess
        </a>
      </p>
      <PageHeader
        title={`${g.white} vs ${g.black}`}
        subtitle={`${g.result}${o ? ` · you ${o === "win" ? "won" : o === "loss" ? "lost" : "drew"}` : ""}${
          g.white_elo || g.black_elo ? ` · ${g.white_elo ?? "?"} v ${g.black_elo ?? "?"}` : ""
        }`}
      />
      <Flash error={error} message={message} />
      {facts.length > 0 && <p className="mb-4 text-sm text-muted">{facts.join(" · ")}</p>}

      {played ? (
        <Card className="mb-6">
          <ChessBoard
            fens={played.fens}
            sans={played.sans}
            ucis={played.ucis}
            flip={g.user_color === "black"}
            gameId={g.id}
            canSavePuzzles={!!g.user_color}
          />
        </Card>
      ) : (
        <p className="mb-6 rounded-md border border-border bg-surface p-3 text-sm text-danger">
          This game&apos;s PGN could not be replayed.
        </p>
      )}

      <Card title="Notes" className="mb-6">
        <form action={saveGameNotes} className="space-y-2">
          <input type="hidden" name="id" value={g.id} />
          <input type="hidden" name="revision" value={g.revision} />
          <textarea
            name="notes"
            rows={4}
            maxLength={4000}
            defaultValue={g.notes}
            placeholder="What did you learn from this game?"
            aria-label="Notes"
            className={inputClass}
          />
          <input
            name="tags"
            defaultValue={g.tags.join(", ")}
            placeholder="Tags, comma separated"
            aria-label="Tags"
            className={inputClass}
          />
          <button type="submit" className={primaryButton}>
            Save notes
          </button>
        </form>
      </Card>

      <Card title="PGN" className="mb-6">
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">
          {g.pgn}
        </pre>
      </Card>

      <form action={deleteGame}>
        <input type="hidden" name="id" value={g.id} />
        <input type="hidden" name="revision" value={g.revision} />
        <button type="submit" className={subtleButton}>
          Remove game
        </button>
      </form>
    </div>
  );
}
