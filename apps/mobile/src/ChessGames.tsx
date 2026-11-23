import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BoardView } from "./BoardView";
import {
  clampPly,
  filterGames,
  gameTitle,
  lastMove,
  movePairs,
  replay,
  resultLabel,
  type GameRow,
  type Outcome,
} from "./chessGames";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Game history: your recent games, filter by outcome, search by opponent or opening; tap one to step through it move by move. Import, analysis and notes are on the website. */
export function ChessGames({
  openId,
  onOpen,
}: {
  openId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const [games, setGames] = useState<GameRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | "all">("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    const r = await supabase
      .from("chess_games")
      .select(
        "id, white, black, result, user_color, opening, played_on, white_elo, black_elo, move_count, time_control",
      )
      .is("deleted_at", null)
      .order("played_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200)
      .overrideTypes<GameRow[]>();
    if (r.error) return setFailed(true);
    setGames(r.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => filterGames(games ?? [], outcome, query), [games, outcome, query]);
  const open = games?.find((g) => g.id === openId) ?? null;

  if (open) return <GameViewer game={open} onBack={() => onOpen(null)} />;

  return (
    <View>
      <View style={s.chips}>
        {(["all", "win", "draw", "loss"] as const).map((o) => (
          <Pressable
            key={o}
            onPress={() => setOutcome(o)}
            style={[s.chip, outcome === o && s.chipOn]}
          >
            <Text style={[s.chipText, outcome === o && s.chipTextOn]}>
              {o === "all" ? "All" : o[0]!.toUpperCase() + o.slice(1) + "s"}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={s.input}
        placeholder="Search opponent or opening"
        placeholderTextColor={C.muted}
        value={query}
        onChangeText={setQuery}
      />
      {failed && <Text style={s.error}>Could not load games. Switch tabs to retry.</Text>}
      {games === null && !failed && (
        <ActivityIndicator color={C.primary} style={{ marginTop: 16 }} />
      )}
      {games && shown.length === 0 && (
        <Text style={s.muted}>
          {games.length === 0 ? "No games yet. Import them on the website." : "Nothing matches."}
        </Text>
      )}
      {shown.map((g) => (
        <Pressable key={g.id} style={s.card} onPress={() => onOpen(g.id)}>
          <View style={s.top}>
            <Text style={s.title} numberOfLines={1}>
              {gameTitle(g)}
            </Text>
            <Text
              style={[
                s.badge,
                resultLabel(g) === "Loss" && { color: C.danger },
                resultLabel(g) === "Win" && { color: "#15803d" },
              ]}
            >
              {resultLabel(g)}
            </Text>
          </View>
          <Text style={s.meta}>
            {[
              g.played_on,
              g.opening,
              g.time_control,
              g.move_count ? `${Math.ceil(g.move_count / 2)} moves` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function GameViewer({ game, onBack }: { game: GameRow; onBack: () => void }) {
  const [pgn, setPgn] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    let alive = true;
    supabase
      .from("chess_games")
      .select("pgn")
      .eq("id", game.id)
      .maybeSingle()
      .then((r) => {
        if (!alive) return;
        if (r.error || !r.data) setFailed(true);
        else setPgn(r.data.pgn as string);
      });
    return () => {
      alive = false;
    };
  }, [game.id]);

  const played = useMemo(() => (pgn ? replay(pgn) : null), [pgn]);
  const max = played ? played.sans.length : 0;
  const at = clampPly(ply, max);
  const flip = game.user_color === "black";

  return (
    <View>
      <Pressable onPress={onBack} hitSlop={10}>
        <Text style={s.back}>‹ All games</Text>
      </Pressable>
      <Text style={s.heading}>{gameTitle(game)}</Text>
      <Text style={s.meta}>
        {[resultLabel(game), game.played_on, game.opening].filter(Boolean).join(" · ")}
      </Text>
      {failed && <Text style={s.error}>Could not load this game.</Text>}
      {pgn === null && !failed && <ActivityIndicator color={C.primary} style={{ marginTop: 16 }} />}
      {pgn !== null && !played && (
        <Text style={s.error}>This game's moves could not be read. Open it on the website.</Text>
      )}
      {played && (
        <View style={{ marginTop: 12 }}>
          <BoardView
            fen={played.fens[at]!}
            flip={flip}
            label={`Position after move ${at}`}
            last={lastMove(played.ucis, at)}
          />
          <View style={s.controls}>
            {[
              { l: "⏮", to: 0 },
              { l: "◀", to: at - 1 },
              { l: "▶", to: at + 1 },
              { l: "⏭", to: max },
            ].map((b) => (
              <Pressable
                key={b.l}
                style={s.ctl}
                onPress={() => setPly(clampPly(b.to, max))}
                accessibilityLabel={
                  b.l === "◀"
                    ? "Previous move"
                    : b.l === "▶"
                      ? "Next move"
                      : b.l === "⏮"
                        ? "Start"
                        : "End"
                }
              >
                <Text style={s.ctlText}>{b.l}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.meta, { textAlign: "center" }]}>
            {at === 0
              ? "Start position"
              : `Move ${Math.ceil(at / 2)}${at % 2 ? "" : "…"}: ${played.sans[at - 1]}`}{" "}
            · {at}/{max}
          </Text>
          <View style={s.moves}>
            {movePairs(played.sans).map((m) => (
              <View key={m.n} style={s.pair}>
                <Text style={s.num}>{m.n}.</Text>
                <Pressable onPress={() => setPly(m.whitePly)}>
                  <Text style={[s.san, at === m.whitePly && s.sanOn]}>{m.white}</Text>
                </Pressable>
                {m.black && (
                  <Pressable onPress={() => setPly(m.whitePly + 1)}>
                    <Text style={[s.san, at === m.whitePly + 1 && s.sanOn]}>{m.black}</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.text, fontSize: 13 },
  chipTextOn: { color: "#fff", fontWeight: "700" },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    color: C.text,
  },
  error: { color: C.danger, marginTop: 8 },
  muted: { color: C.muted, marginTop: 8 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: C.text, fontWeight: "700" },
  badge: { color: C.muted, fontWeight: "700", fontSize: 12 },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
  back: { color: C.primary, fontWeight: "600", marginBottom: 8 },
  heading: { fontSize: 20, fontWeight: "800", color: C.text },
  controls: { flexDirection: "row", gap: 10, justifyContent: "center", marginVertical: 12 },
  ctl: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  ctlText: { fontSize: 18, color: C.primary },
  moves: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  pair: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: "46%" },
  num: { color: C.muted, width: 26, fontSize: 13 },
  san: { color: C.text, fontSize: 14, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6 },
  sanOn: { backgroundColor: "#f2d36b", fontWeight: "700" },
});
