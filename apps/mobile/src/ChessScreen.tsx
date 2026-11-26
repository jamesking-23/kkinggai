import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BoardView } from "./BoardView";
import { ChessGames } from "./ChessGames";
import { ChessPlay } from "./ChessPlay";
import { ChessRepertoire } from "./ChessRepertoire";
import {
  legalTargets,
  nextSchedule,
  ownsSquare,
  resolveClick,
  sanForUci,
  type PuzzleRow,
} from "./chessPuzzles";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

type Answer = { uci: string; san: string } | "reveal";

/** Puzzles made from your own mistakes. Tap a piece, then a square; the answer is checked against the engine move saved with the puzzle and the review is scheduled like on the website. */
function Puzzles() {
  const [puzzle, setPuzzle] = useState<PuzzleRow | null>(null);
  const [due, setDue] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const now = new Date().toISOString();
    const [next, dueCount, all] = await Promise.all([
      supabase
        .from("chess_puzzles")
        .select(
          "id, game_id, fen, side_to_move, solution_uci, played_uci, loss_cp, box, attempts, correct, revision",
        )
        .is("deleted_at", null)
        .lte("next_due_at", now)
        .order("next_due_at", { ascending: true })
        .limit(1)
        .overrideTypes<PuzzleRow[]>(),
      supabase
        .from("chess_puzzles")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .lte("next_due_at", now),
      supabase
        .from("chess_puzzles")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
    ]);
    if (next.error || dueCount.error || all.error) {
      setFailed(true);
    } else {
      setPuzzle(next.data?.[0] ?? null);
      setDue(dueCount.count ?? 0);
      setTotal(all.count ?? 0);
    }
    setFrom(null);
    setAnswer(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const side: "white" | "black" = puzzle?.side_to_move === "black" ? "black" : "white";
  const flip = side === "black";
  const targets = useMemo(
    () => (puzzle && from ? legalTargets(puzzle.fen, from) : new Set<string>()),
    [puzzle, from],
  );
  const done = answer !== null;
  const correct = !!puzzle && !!answer && answer !== "reveal" && answer.uci === puzzle.solution_uci;

  function tap(square: string) {
    if (!puzzle || done) return;
    if (!from) {
      if (ownsSquare(puzzle.fen, square, side)) setFrom(square);
      return;
    }
    if (square === from) return setFrom(null);
    const res = resolveClick(puzzle.fen, from, square, puzzle.solution_uci);
    if (res) {
      setAnswer(res);
      setFrom(null);
    } else if (ownsSquare(puzzle.fen, square, side)) setFrom(square);
    else setFrom(null);
  }

  async function record() {
    if (!puzzle || !answer || saving) return;
    setSaving(true);
    setProblem(null);
    const isCorrect = answer !== "reveal" && answer.uci === puzzle.solution_uci;
    const sched = nextSchedule(puzzle.box, isCorrect, new Date());
    const { data, error } = await supabase
      .from("chess_puzzles")
      .update({
        box: sched.box,
        next_due_at: sched.dueAt.toISOString(),
        attempts: puzzle.attempts + 1,
        correct: puzzle.correct + (isCorrect ? 1 : 0),
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", puzzle.id)
      .eq("revision", puzzle.revision)
      .select("id");
    setSaving(false);
    if (error) return setProblem("Could not record the attempt. Check your connection.");
    if (!data || data.length === 0)
      setProblem("This puzzle was changed elsewhere. It has been refreshed.");
    load();
  }

  return (
    <View>
      <Text style={s.heading}>Train on your mistakes</Text>
      <Text style={s.muted}>
        {due} due · {total} saved
      </Text>
      {loading && <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />}
      {failed && (
        <Text style={s.error}>Could not load puzzles. Switch tabs and back to retry.</Text>
      )}
      {problem && <Text style={s.error}>{problem}</Text>}

      {!loading && !failed && !puzzle && (
        <Text style={[s.muted, { marginTop: 16 }]}>
          {total
            ? "Nothing due right now. Come back later."
            : "No puzzles yet. On the website, open a game, run the analysis, then save its mistakes as puzzles."}
        </Text>
      )}

      {puzzle && (
        <View style={{ marginTop: 12 }}>
          <BoardView
            fen={puzzle.fen}
            flip={flip}
            label={`Puzzle board, ${side} to move`}
            selected={from}
            targets={targets}
            onSquare={done ? undefined : tap}
          />
          {!done ? (
            <View style={s.row}>
              <Text style={[s.text, { flex: 1 }]}>
                {side === "white" ? "White" : "Black"} to move. Find the best move.
              </Text>
              <Pressable style={s.ghost} onPress={() => setAnswer("reveal")}>
                <Text style={s.ghostText}>Show answer</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Text style={[s.text, { color: correct ? "#15803d" : C.danger, fontWeight: "700" }]}>
                {answer === "reveal"
                  ? `Answer revealed: ${sanForUci(puzzle.fen, puzzle.solution_uci) ?? puzzle.solution_uci}. This counts as a miss.`
                  : correct
                    ? `${answer.san} is the engine's move.`
                    : `${answer.san} is not the engine's move. It was ${sanForUci(puzzle.fen, puzzle.solution_uci) ?? puzzle.solution_uci}.`}
              </Text>
              <Pressable
                style={[s.btn, saving && { opacity: 0.5 }]}
                disabled={saving}
                onPress={record}
              >
                <Text style={s.btnText}>Record and continue</Text>
              </Pressable>
            </View>
          )}
          <Text style={[s.muted, { marginTop: 14 }]}>
            You played {sanForUci(puzzle.fen, puzzle.played_uci) ?? puzzle.played_uci} here, about{" "}
            {puzzle.loss_cp} centipawns worse than the engine's choice.
            {puzzle.attempts > 0 ? ` Solved ${puzzle.correct} of ${puzzle.attempts} tries.` : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Native chess: puzzles from your own mistakes, and your game history with a move-by-move viewer. Live play with a friend is in the Play tab. Repertoire drills are in the Drills tab. Import, analysis and board settings stay on the website. */
export function ChessScreen({
  onBack,
  onOpenWeb,
  joinCode = null,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
  /** An invite code from a tapped link: opens the Play tab with it filled in. */
  joinCode?: string | null;
}) {
  const [tab, setTab] = useState<"puzzles" | "games" | "drills" | "play">(
    joinCode ? "play" : "puzzles",
  );
  const [openGame, setOpenGame] = useState<string | null>(null);
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Chess"
        onBack={onBack}
        action={{ label: "Full chess", onPress: onOpenWeb }}
      />
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.tabs}>
          {(["puzzles", "games", "drills", "play"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTab(t);
                setOpenGame(null);
              }}
              style={[s.tab, tab === t && s.tabOn]}
            >
              <Text style={[s.tabText, tab === t && s.tabTextOn]}>
                {t === "puzzles"
                  ? "Puzzles"
                  : t === "games"
                    ? "Games"
                    : t === "drills"
                      ? "Drills"
                      : "Play"}
              </Text>
            </Pressable>
          ))}
        </View>
        {tab === "puzzles" ? (
          <Puzzles />
        ) : tab === "games" ? (
          <ChessGames openId={openGame} onOpen={setOpenGame} />
        ) : tab === "drills" ? (
          <ChessRepertoire />
        ) : (
          <ChessPlay initialCode={joinCode} />
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: C.card,
  },
  tabOn: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { color: C.text, fontWeight: "600" },
  tabTextOn: { color: "#fff" },
  heading: { fontSize: 22, fontWeight: "800", color: C.text },
  muted: { color: C.muted, fontSize: 13, marginTop: 2 },
  text: { color: C.text },
  error: { color: C.danger, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
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
