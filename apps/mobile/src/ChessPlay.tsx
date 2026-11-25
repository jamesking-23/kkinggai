import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BoardView } from "./BoardView";
import { legalTargets, ownsSquare } from "./chessPuzzles";
import {
  clocksAt,
  extractInviteCode,
  formatClock,
  movePairs,
  pollIntervalMs,
  promotionPieces,
  replayMoves,
  sideOf,
  summarise,
  TIME_CONTROLS,
  uciFor,
} from "./mp";
import { supabase } from "./supabase";
import { C } from "./theme";
import { SITE_URL } from "./web";

type Game = {
  id: string;
  status: string;
  moves: string[];
  white_id: string | null;
  black_id: string | null;
  white_name: string | null;
  black_name: string | null;
  resigned_by: string | null;
  timed_out_by: string | null;
  invited_id: string | null;
  invite_code: string | null;
  draw_offer_by: string | null;
  clock_seconds: number | null;
  white_ms: number | null;
  black_ms: number | null;
  clock_started_at: string | null;
  updated_at: string;
};
const COLS =
  "id, status, moves, white_id, black_id, white_name, black_name, resigned_by, timed_out_by, invited_id, invite_code, draw_offer_by, clock_seconds, white_ms, black_ms, clock_started_at, updated_at";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PROMO_NAME: Record<string, string> = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" };

/** Errors from the mp_* database functions are written for people, so they are shown as they are. */
const reason = (e: { message: string }) => e.message.slice(0, 200);

function GameView({
  id,
  userId,
  onBack,
  onOpen,
}: {
  id: string;
  userId: string;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const [g, setG] = useState<Game | null>(null);
  const [missing, setMissing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<"subscribed" | "connecting" | "failed">("connecting");
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const r = await supabase.from("mp_games").select(COLS).eq("id", id).maybeSingle();
    if (r.error) return setProblem("Could not load the game. Pull back and retry.");
    if (!r.data) return setMissing(true);
    setG(r.data as Game);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: reload as soon as the game row changes. Polling is the safety net.
  useEffect(() => {
    const ch = supabase
      .channel(`mp-game-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mp_games", filter: `id=eq.${id}` },
        () => void load(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setChannel("subscribed");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
          setChannel("failed");
      });
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [id, load]);

  const open = !!g && (g.status === "active" || g.status === "waiting");
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void load(), pollIntervalMs(channel));
    return () => clearInterval(t);
  }, [open, channel, load]);

  // Redraw the clocks five times a second while one is running.
  useEffect(() => {
    if (!g || g.clock_seconds === null || g.status !== "active") return;
    const t = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [g]);

  const rep = useMemo(() => (g ? replayMoves(g.moves) : null), [g]);
  const summary = g && rep ? summarise(g, rep) : null;
  const side = g ? sideOf(g, userId) : null;
  const fen = rep?.ok ? rep.fen : START;
  const active = !!g && g.status === "active" && !!summary && !summary.finished;
  const myTurn = !!side && !!rep?.ok && (rep.turn === "w") === (side === "white");
  const canMove = active && myTurn && !busy;
  // `tick` only forces a redraw. Clocks use the phone's clock against the server's start time, so a phone with a wrong
  // clock shows wrong times; the database still decides who lost on time.
  void tick;
  const clocksNow = g ? clocksAt(g, Date.now()) : null;

  async function rpc(name: string, args: Record<string, unknown>) {
    setBusy(true);
    setProblem(null);
    const r = await supabase.rpc(name, args);
    setBusy(false);
    if (r.error) {
      setProblem(reason(r.error));
      void load();
      return null;
    }
    await load();
    return r.data as unknown;
  }

  async function send(uci: string) {
    if (!g) return;
    setFrom(null);
    setPromo(null);
    // Check the move against the rules first; the database also checks the turn and that the game is still on.
    await rpc("mp_move", { game: g.id, expected_ply: g.moves.length, uci });
  }

  function tap(square: string) {
    if (!canMove || !g) return;
    if (promo) setPromo(null);
    if (!from) {
      if (side && ownsSquare(fen, square, side)) setFrom(square);
      return;
    }
    if (square === from) return setFrom(null);
    if (side && ownsSquare(fen, square, side)) return setFrom(square);
    if (promotionPieces(fen, from, square).length > 0) return setPromo({ from, to: square });
    const uci = uciFor(fen, from, square);
    if (uci) void send(uci);
    else setFrom(null);
  }

  const targets = useMemo(() => (from ? legalTargets(fen, from) : new Set<string>()), [from, fen]);

  if (missing) return <Text style={s.muted}>This game no longer exists.</Text>;
  if (!g || !rep || !summary) return <ActivityIndicator color={C.primary} />;

  const opp = side === "white" ? g.black_name : g.white_name;
  const invitedMe = g.status === "waiting" && g.invited_id === userId;
  const offerByMe = g.draw_offer_by === userId;
  const offerByThem = !!g.draw_offer_by && !offerByMe;
  const link = g.invite_code ? `${SITE_URL}/chess/play/join/${g.invite_code}` : null;
  const running = clocksNow?.running ?? null;
  const flagged =
    !!clocksNow &&
    ((running === "w" && clocksNow.whiteMs === 0) || (running === "b" && clocksNow.blackMs === 0));
  const canClaim = flagged && !!side && side !== (running === "w" ? "white" : "black");
  const finished = summary.finished;

  const clockCell = (label: string, ms: number, on: boolean) => (
    <View style={[s.clock, on && s.clockOn]} accessibilityLabel={`${label} clock`}>
      <Text style={s.clockLabel}>{label}</Text>
      <Text style={[s.clockText, on && ms < 10000 && { color: C.danger }]}>{formatClock(ms)}</Text>
    </View>
  );

  return (
    <View>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={s.link}>← Games</Text>
      </Pressable>
      <Text style={s.title}>vs {opp ?? "an opponent to be"}</Text>
      <Text style={s.muted}>
        You play {side ?? "neither side"} · {summary.text}
        {active && myTurn ? " · your move" : ""}
      </Text>
      {problem && <Text style={s.error}>{problem}</Text>}
      {channel === "failed" && active && (
        <Text style={s.muted}>Live updates are unavailable; checking every few seconds.</Text>
      )}

      {g.status === "waiting" && !g.invited_id && link && (
        <View style={s.card}>
          <Text style={s.body}>Send this link to your opponent:</Text>
          <Text selectable style={s.code}>
            {link}
          </Text>
          <Pressable
            style={s.btn}
            onPress={() => void Share.share({ message: `Play chess with me: ${link}` })}
          >
            <Text style={s.btnText}>Share invite link</Text>
          </Pressable>
        </View>
      )}
      {g.status === "waiting" && g.invited_id && !invitedMe && (
        <Text style={s.card}>Waiting for your opponent to accept this rematch.</Text>
      )}
      {invitedMe && (
        <View style={s.card}>
          <Text style={s.body}>You have been invited to this game.</Text>
          <View style={s.row}>
            <Pressable
              style={s.btn}
              disabled={busy}
              onPress={() => void rpc("mp_accept", { game: g.id })}
            >
              <Text style={s.btnText}>Accept</Text>
            </Pressable>
            <Pressable
              style={s.btnAlt}
              disabled={busy}
              onPress={async () => {
                await rpc("mp_decline", { game: g.id });
                onBack();
              }}
            >
              <Text style={s.btnAltText}>Decline</Text>
            </Pressable>
          </View>
        </View>
      )}

      {clocksNow && (
        <View style={[s.row, { marginVertical: 8 }]}>
          {clockCell("White", clocksNow.whiteMs, running === "w")}
          {clockCell("Black", clocksNow.blackMs, running === "b")}
        </View>
      )}
      {canClaim && (
        <Pressable
          style={s.btn}
          disabled={busy}
          onPress={() => void rpc("mp_claim_timeout", { game: g.id })}
        >
          <Text style={s.btnText}>Claim win on time</Text>
        </Pressable>
      )}

      <View style={{ marginVertical: 8 }}>
        <BoardView
          fen={fen}
          flip={side === "black"}
          label={`Chess board, you play ${side ?? "white"}`}
          selected={from}
          targets={targets}
          last={rep.ok ? rep.last : null}
          onSquare={canMove ? tap : undefined}
        />
      </View>
      {promo && (
        <View style={s.card}>
          <Text style={s.body}>Promote to</Text>
          <View style={s.row}>
            {promotionPieces(fen, promo.from, promo.to).map((p) => (
              <Pressable
                key={p}
                style={s.btn}
                onPress={() => {
                  const uci = uciFor(fen, promo.from, promo.to, p);
                  if (uci) void send(uci);
                }}
              >
                <Text style={s.btnText}>{PROMO_NAME[p]}</Text>
              </Pressable>
            ))}
            <Pressable
              style={s.btnAlt}
              onPress={() => {
                setPromo(null);
                setFrom(null);
              }}
            >
              <Text style={s.btnAltText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
      {busy && <ActivityIndicator color={C.primary} />}

      {side && (g.status === "waiting" || active) && (
        <View style={[s.row, { marginTop: 8 }]}>
          <Pressable
            style={s.btnAlt}
            disabled={busy}
            onPress={() =>
              Alert.alert(
                g.status === "waiting" ? "Cancel game?" : "Resign?",
                g.status === "waiting"
                  ? "The invite will stop working."
                  : "You will lose this game.",
                [
                  { text: "Keep playing", style: "cancel" },
                  {
                    text: g.status === "waiting" ? "Cancel game" : "Resign",
                    style: "destructive",
                    onPress: () => void rpc("mp_resign", { game: g.id }),
                  },
                ],
              )
            }
          >
            <Text style={s.btnAltText}>{g.status === "waiting" ? "Cancel game" : "Resign"}</Text>
          </Pressable>
          {active && !offerByMe && !offerByThem && (
            <Pressable
              style={s.btnAlt}
              disabled={busy}
              onPress={() => void rpc("mp_draw", { game: g.id, action: "offer" })}
            >
              <Text style={s.btnAltText}>Offer draw</Text>
            </Pressable>
          )}
          {active && offerByMe && <Text style={s.muted}>Draw offered</Text>}
          {active && offerByThem && (
            <>
              <Pressable
                style={s.btn}
                disabled={busy}
                onPress={() => void rpc("mp_draw", { game: g.id, action: "accept" })}
              >
                <Text style={s.btnText}>Accept draw</Text>
              </Pressable>
              <Pressable
                style={s.btnAlt}
                disabled={busy}
                onPress={() => void rpc("mp_draw", { game: g.id, action: "decline" })}
              >
                <Text style={s.btnAltText}>Decline</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
      {side && finished && g.moves.length > 0 && (
        <Pressable
          style={[s.btn, { marginTop: 8 }]}
          disabled={busy}
          onPress={async () => {
            const nid = await rpc("mp_rematch", { game: g.id });
            if (typeof nid === "string") onOpen(nid);
          }}
        >
          <Text style={s.btnText}>Offer rematch</Text>
        </Pressable>
      )}

      <Text style={[s.body, { marginTop: 12, fontWeight: "700" }]}>Moves</Text>
      {rep.ok && rep.sans.length ? (
        movePairs(rep.sans).map((m) => (
          <Text key={m} style={s.mono}>
            {m}
          </Text>
        ))
      ) : (
        <Text style={s.muted}>No moves yet</Text>
      )}
    </View>
  );
}

/** Live games against a friend: create a game, share the invite link (or paste one you received), and play with clocks. Moves are checked on the phone and again by the database. */
export function ChessPlay({ initialCode = null }: { initialCode?: string | null }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [games, setGames] = useState<Game[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [color, setColor] = useState<"random" | "white" | "black">("random");
  const [control, setControl] = useState<string>("none");
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const [u, r] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("mp_games").select(COLS).order("updated_at", { ascending: false }).limit(50),
    ]);
    if (r.error || u.error || !u.data.user) return setFailed(true);
    setUserId(u.data.user.id);
    setGames((r.data ?? []) as Game[]);
  }, []);

  useEffect(() => {
    if (!openId) void load();
  }, [load, openId]);

  async function create() {
    setBusy(true);
    setProblem(null);
    const tc = TIME_CONTROLS.find((t) => t.id === control) ?? TIME_CONTROLS[0];
    const pick = color === "random" ? (Math.random() < 0.5 ? "white" : "black") : color;
    const r = await supabase.rpc("mp_create", {
      color: pick,
      minutes: tc.minutes,
      increment: tc.increment,
    });
    setBusy(false);
    const row = (r.data as { id: string }[] | null)?.[0];
    if (r.error || !row) return setProblem(r.error ? reason(r.error) : "Could not create the game");
    setOpenId(row.id);
  }

  async function join() {
    const c = extractInviteCode(code);
    if (!c) return setProblem("Paste the invite link or its 32-character code");
    setBusy(true);
    setProblem(null);
    const r = await supabase.rpc("mp_join", { code: c });
    setBusy(false);
    if (r.error || !r.data)
      return setProblem(r.error ? reason(r.error) : "Could not join the game");
    setCode("");
    setOpenId(r.data as string);
  }

  if (failed)
    return <Text style={s.error}>Could not load your games. Switch tabs and back to retry.</Text>;
  if (!userId || !games) return <ActivityIndicator color={C.primary} />;

  if (openId)
    return (
      <GameView id={openId} userId={userId} onBack={() => setOpenId(null)} onOpen={setOpenId} />
    );

  return (
    <View>
      <View style={s.card}>
        <Text style={s.body}>New game</Text>
        <View style={s.row}>
          {(["random", "white", "black"] as const).map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[s.chip, color === c && s.chipOn]}
            >
              <Text style={[s.chipText, color === c && s.chipTextOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.row}>
          {TIME_CONTROLS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setControl(t.id)}
              style={[s.chip, control === t.id && s.chipOn]}
            >
              <Text style={[s.chipText, control === t.id && s.chipTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={s.btn} disabled={busy} onPress={() => void create()}>
          <Text style={s.btnText}>Create game</Text>
        </Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.body}>Join with an invite</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Paste invite link or code"
          autoCapitalize="none"
          autoCorrect={false}
          style={s.input}
        />
        <Pressable style={s.btn} disabled={busy} onPress={() => void join()}>
          <Text style={s.btnText}>Join game</Text>
        </Pressable>
      </View>
      {problem && <Text style={s.error}>{problem}</Text>}

      <Text style={[s.body, { fontWeight: "700", marginTop: 8 }]}>Your games</Text>
      {games.length === 0 && (
        <Text style={s.muted}>No games yet. Create one and share the link.</Text>
      )}
      {games.map((g) => {
        const invited = g.invited_id === userId && g.status === "waiting";
        const mineWhite = g.white_id === userId;
        const opp = mineWhite ? g.black_name : g.white_name;
        const sum = summarise(g, replayMoves(g.moves));
        return (
          <Pressable key={g.id} style={s.card} onPress={() => setOpenId(g.id)}>
            <Text style={s.body}>
              {invited
                ? `${(g.white_id ? g.white_name : g.black_name) ?? "Someone"} invited you to a rematch`
                : `vs ${opp ?? "(waiting)"} · you are ${mineWhite ? "white" : "black"}`}
            </Text>
            <Text style={sum.finished ? s.muted : s.active}>
              {invited ? "Tap to accept or decline" : sum.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  body: { color: C.text, fontSize: 15 },
  muted: { color: C.muted, fontSize: 13 },
  active: { color: C.primary, fontSize: 13, fontWeight: "600" },
  error: { color: C.danger, marginVertical: 6 },
  link: { color: C.primary, fontWeight: "600", marginBottom: 6 },
  title: { color: C.text, fontSize: 20, fontWeight: "700" },
  code: { color: C.text, fontSize: 12 },
  mono: { color: C.text, fontFamily: "monospace", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    color: C.text,
    backgroundColor: "#fff",
  },
  btn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  btnAlt: {
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  btnAltText: { color: C.text, fontWeight: "600" },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.text, fontSize: 13 },
  chipTextOn: { color: "#fff" },
  clock: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    gap: 6,
    alignItems: "baseline",
  },
  clockOn: { borderColor: C.primary },
  clockLabel: { color: C.muted, fontSize: 11 },
  clockText: { color: C.text, fontSize: 18, fontFamily: "monospace" },
});
