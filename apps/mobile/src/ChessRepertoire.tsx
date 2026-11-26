import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BoardView } from "./BoardView";
import { legalTargets, ownsSquare, resolveClick } from "./chessPuzzles";
import {
  buildRepertoire,
  drillPositions,
  formatPath,
  scorePercent,
  type RepGame,
} from "./chessRepertoire";
import { supabase } from "./supabase";
import { C } from "./theme";

const MAX_GAMES = 1000;
const DRILL_LIMIT = 40;

type Answer = { uci: string; san: string } | "reveal";

/** Shows a position from your own games and asks for your usual move; then shows what you actually played. */
export function ChessRepertoire() {
  const [games, setGames] = useState<RepGame[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [i, setI] = useState(0);
  const [from, setFrom] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [tally, setTally] = useState({ main: 0, other: 0, unknown: 0 });

  const load = useCallback(async () => {
    setFailed(false);
    const { data, error } = await supabase
      .from("chess_games")
      .select("pgn, user_color, result")
      .not("user_color", "is", null)
      .is("deleted_at", null)
      .order("played_on", { ascending: false, nullsFirst: false })
      .limit(MAX_GAMES)
      .overrideTypes<RepGame[]>();
    if (error) setFailed(true);
    else setGames(data ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const positions = useMemo(
    () =>
      games
        ? drillPositions(buildRepertoire(games))
            .slice(0, DRILL_LIMIT)
            .map((p) => ({ ...p, moves: p.moves.slice(0, 6) }))
        : [],
    [games],
  );

  if (failed)
    return (
      <View>
        <Text style={s.error}>Could not load your games.</Text>
        <Pressable style={s.btn} onPress={() => void load()}>
          <Text style={s.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  if (!games) return <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />;
  if (positions.length === 0)
    return (
      <Text style={s.muted}>
        Nothing to drill yet. Import games on the website and save your player names so your side is
        known; a position needs to appear in at least two games with a clear main move.
      </Text>
    );

  const pos = positions[i % positions.length]!;
  const main = pos.moves[0]!;
  const flip = pos.color === "black";

  function tap(square: string) {
    if (answer) return;
    if (!from) {
      if (ownsSquare(pos.fen, square, pos.color)) setFrom(square);
      return;
    }
    if (square === from) return setFrom(null);
    const m = resolveClick(pos.fen, from, square, main.uci);
    if (!m) return setFrom(ownsSquare(pos.fen, square, pos.color) ? square : null);
    setAnswer(m);
    setFrom(null);
    const hit = pos.moves.find((x) => x.uci === m.uci);
    setTally((t) =>
      hit === main
        ? { ...t, main: t.main + 1 }
        : hit
          ? { ...t, other: t.other + 1 }
          : { ...t, unknown: t.unknown + 1 },
    );
  }

  const chosen = answer && answer !== "reveal" ? pos.moves.find((x) => x.uci === answer.uci) : null;
  const verdict =
    answer === null
      ? null
      : answer === "reveal"
        ? `Your usual move here is ${main.san}.`
        : chosen === main
          ? `Yes, ${main.san} is your main move here.`
          : chosen
            ? `You have played ${chosen.san} here too, but your main move is ${main.san}.`
            : `You have not played ${answer.san} here. Your main move is ${main.san}.`;

  return (
    <View>
      <Text style={s.muted}>
        Position {(i % positions.length) + 1} of {positions.length} · you play {pos.color}
      </Text>
      <Text style={[s.text, { marginTop: 4, marginBottom: 10 }]}>
        After <Text style={{ fontWeight: "700" }}>{formatPath(pos.path)}</Text> (reached in{" "}
        {pos.total} games)
      </Text>
      <BoardView
        fen={pos.fen}
        flip={flip}
        label={`Position ${i + 1}, you play ${pos.color}`}
        selected={from}
        targets={from ? legalTargets(pos.fen, from) : undefined}
        onSquare={answer ? undefined : tap}
      />
      {answer === null ? (
        <>
          <Text style={[s.text, { marginTop: 12 }]}>
            What do you usually play here? Tap a piece, then a square.
          </Text>
          <Pressable
            style={[s.ghost, { marginTop: 10, alignSelf: "flex-start" }]}
            onPress={() => {
              setAnswer("reveal");
              setFrom(null);
            }}
          >
            <Text style={s.ghostText}>Show my moves</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text
            accessibilityRole="alert"
            style={[s.text, { marginTop: 12, fontWeight: "700" }, chosen === main && s.good]}
          >
            {verdict}
          </Text>
          {pos.moves.map((m) => {
            const sc = scorePercent(m);
            return (
              <View key={m.uci} style={s.moveRow}>
                <Text style={[s.text, { fontWeight: "700", width: 64 }]}>{m.san}</Text>
                <Text style={[s.muted, { flex: 1 }]}>
                  {m.count} ({Math.round((m.count / pos.total) * 100)}%) ·{" "}
                  {sc === null ? "–" : `${sc}%`} · {m.wins}/{m.draws}/{m.losses}
                </Text>
              </View>
            );
          })}
          <Pressable
            style={s.btn}
            onPress={() => {
              setAnswer(null);
              setFrom(null);
              setI((n) => n + 1);
            }}
          >
            <Text style={s.btnText}>Next position</Text>
          </Pressable>
        </>
      )}
      <Text style={[s.muted, { marginTop: 14 }]}>
        This session: {tally.main} main move · {tally.other} other known · {tally.unknown} new
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  text: { color: C.text },
  muted: { color: C.muted, fontSize: 13, marginTop: 2 },
  error: { color: C.danger, marginTop: 12 },
  good: { color: "#15803d" },
  moveRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingVertical: 8,
  },
  btn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
    marginTop: 12,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  ghost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ghostText: { color: C.primary, fontWeight: "600", fontSize: 13 },
});
