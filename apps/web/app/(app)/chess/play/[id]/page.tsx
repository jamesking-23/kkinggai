import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireModule } from "../../../../../lib/modules";
import { getAppContext } from "../../../../../lib/session";
import { createClient } from "../../../../../lib/supabase/server";
import { clocksAt, movePairs, replayMoves, sideOf, summarise } from "../../../../../lib/mp";
import type { FlashParams } from "../../../../../lib/form";
import { Card, Flash, PageHeader, primaryButton, subtleButton } from "../../../../../components/ui";
import { MpBoard } from "../../../../../components/mp-board";
import { MpClock } from "../../../../../components/mp-clock";
import { acceptInvite, declineInvite, drawAction, resignGame, rematchGame } from "../actions";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "chess");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const { data: g } = await supabase.from("mp_games").select("*").eq("id", id).maybeSingle();
  if (!g) notFound();

  const side = sideOf(g, ctx.userId);
  const clocks = clocksAt(g, Date.now());
  const rep = replayMoves(g.moves);
  const s = summarise(g, rep);
  const fen = rep.ok ? rep.fen : START;
  const active = g.status === "active" && !s.finished;
  const myTurn = !!side && rep.ok && (rep.turn === "w") === (side === "white");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const link = g.invite_code ? `${proto}://${host}/chess/play/join/${g.invite_code}` : null;
  const offerByMe = g.draw_offer_by === ctx.userId;
  const offerByThem = !!g.draw_offer_by && !offerByMe;
  const opp = side === "white" ? g.black_name : g.white_name;
  const invitedMe = g.status === "waiting" && g.invited_id === ctx.userId;
  const { data: rematch } = side
    ? await supabase
        .from("mp_games")
        .select("id")
        .eq("rematch_of", g.id)
        .neq("status", "cancelled")
        .maybeSingle()
    : { data: null };
  const canRematch =
    !!side && !rematch && g.moves.length > 0 && (s.finished || g.status === "active");
  const hidden = (name: string, v: string) => <input type="hidden" name={name} value={v} />;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href="/chess/play" className="text-primary">
          ← Games
        </a>
      </p>
      <PageHeader
        title={`vs ${opp ?? "an opponent to be"}`}
        subtitle={`You play ${side ?? "neither side"} · ${s.text}${active && myTurn ? " · your move" : ""}`}
      />
      <Flash error={error} message={message} />

      {g.status === "waiting" && link && !g.invited_id && (
        <Card>
          <p className="mb-2 text-sm">Send this link to your opponent:</p>
          <input
            readOnly
            value={link}
            className="w-full rounded-md border border-border p-2 text-xs"
          />
        </Card>
      )}

      {g.status === "waiting" && g.invited_id && !invitedMe && (
        <Card>
          <p className="text-sm">Waiting for your opponent to accept this rematch.</p>
        </Card>
      )}
      {invitedMe && (
        <Card>
          <p className="mb-2 text-sm">You have been invited to this game.</p>
          <div className="flex gap-2">
            <form action={acceptInvite}>
              {hidden("id", g.id)}
              <button className={primaryButton}>Accept</button>
            </form>
            <form action={declineInvite}>
              {hidden("id", g.id)}
              <button className={subtleButton}>Decline</button>
            </form>
          </div>
        </Card>
      )}
      {rematch && (
        <p className="mt-2 text-sm">
          <a href={`/chess/play/${rematch.id}`} className="text-primary">
            Go to the rematch →
          </a>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-6">
        <div>
          {clocks && (
            <MpClock
              gameId={g.id}
              whiteMs={clocks.whiteMs}
              blackMs={clocks.blackMs}
              running={clocks.running}
              viewer={side}
            />
          )}
          <MpBoard
            gameId={g.id}
            fen={fen}
            side={side ?? "white"}
            canMove={active && myTurn}
            waiting={(active && !myTurn) || g.status === "waiting"}
            last={rep.ok ? rep.last : null}
          />
        </div>
        <div className="min-w-48 flex-1 space-y-3 text-sm">
          <div className="max-h-64 overflow-auto font-mono">
            {rep.ok && rep.sans.length ? (
              movePairs(rep.sans).map((m) => <div key={m}>{m}</div>)
            ) : (
              <span className="text-muted">No moves yet</span>
            )}
          </div>
          {canRematch && s.finished && (
            <form action={rematchGame}>
              {hidden("id", g.id)}
              <button className={subtleButton}>Offer rematch</button>
            </form>
          )}
          {side && (g.status === "waiting" || active) && (
            <div className="flex flex-wrap gap-2">
              <form action={resignGame}>
                {hidden("id", g.id)}
                <button className={subtleButton}>
                  {g.status === "waiting" ? "Cancel game" : "Resign"}
                </button>
              </form>
              {active && !offerByMe && !offerByThem && (
                <form action={drawAction}>
                  {hidden("id", g.id)}
                  {hidden("action", "offer")}
                  <button className={subtleButton}>Offer draw</button>
                </form>
              )}
              {active && offerByMe && <span className="text-muted">Draw offered</span>}
              {active && offerByThem && (
                <>
                  <form action={drawAction}>
                    {hidden("id", g.id)}
                    {hidden("action", "accept")}
                    <button className={subtleButton}>Accept draw</button>
                  </form>
                  <form action={drawAction}>
                    {hidden("id", g.id)}
                    {hidden("action", "decline")}
                    <button className={subtleButton}>Decline</button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
