import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  checkCard,
  cleanDeckName,
  deckCounts,
  dueCards,
  RATINGS,
  schedule,
  type CardRow,
  type DeckRow,
  type Rating,
} from "./flashcards";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

type Mode = "list" | "study" | "addCard" | "addDeck";

/** Native flashcards: study due cards with the website's spaced-repetition schedule, add cards and decks. Quizzes, deleting and course links stay on the website. */
export function FlashcardsScreen({
  onBack,
  onOpenWeb,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
}) {
  const [decks, setDecks] = useState<DeckRow[] | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [wsId, setWsId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [studyDeck, setStudyDeck] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(0);
  const [deckName, setDeckName] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [cardDeck, setCardDeck] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const [d, c, w] = await Promise.all([
      supabase
        .from("flashcard_decks")
        .select("id, name, revision")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .overrideTypes<DeckRow[]>(),
      supabase
        .from("flashcards")
        .select(
          "id, deck_id, front, back, due_at, ease, interval_days, repetitions, lapses, revision",
        )
        .is("deleted_at", null)
        .order("due_at")
        .limit(500)
        .overrideTypes<CardRow[]>(),
      supabase.from("workspaces").select("id").order("created_at").limit(1).maybeSingle(),
    ]);
    if (d.error || c.error) return setFailed(true);
    setDecks(d.data ?? []);
    setCards(c.data ?? []);
    setWsId(w.data?.id ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  const counts = useMemo(() => deckCounts(decks ?? [], cards, new Date()), [decks, cards]);
  const queue = dueCards(cards, now, studyDeck).filter((c) => !skipped.includes(c.id));
  const current = queue[0];
  const totalDue = dueCards(cards, now).length;

  async function rate(c: CardRow, rating: Rating) {
    if (saving) return;
    setSaving(true);
    setProblem(null);
    const t = new Date();
    const next = schedule(
      {
        ease: Number(c.ease),
        intervalDays: c.interval_days,
        repetitions: c.repetitions,
        lapses: c.lapses,
      },
      rating,
      t,
    );
    const { data, error } = await supabase
      .from("flashcards")
      .update({
        ease: next.ease,
        interval_days: next.intervalDays,
        repetitions: next.repetitions,
        lapses: next.lapses,
        due_at: next.dueAt.toISOString(),
        last_reviewed_at: t.toISOString(),
      })
      .eq("id", c.id)
      .eq("revision", c.revision)
      .select("id");
    if (error) {
      setSaving(false);
      return setProblem("Could not save the review.");
    }
    if (!data || data.length === 0) {
      setSaving(false);
      setProblem("This card was changed elsewhere. It has been refreshed; try again.");
      return load();
    }
    if (wsId)
      await supabase.from("card_reviews").insert({ workspace_id: wsId, card_id: c.id, rating });
    setSaving(false);
    setShown(false);
    setReviewed((n) => n + 1);
    await load();
  }

  async function addDeck() {
    const name = cleanDeckName(deckName);
    if (!name) return setProblem("Enter a deck name.");
    if (!wsId) return setProblem("Could not find your workspace.");
    if (saving) return;
    setSaving(true);
    setProblem(null);
    const { error } = await supabase
      .from("flashcard_decks")
      .insert({ workspace_id: wsId, name, description: "" });
    setSaving(false);
    if (error) return setProblem("Could not create the deck.");
    setDeckName("");
    setMode("list");
    load();
  }

  async function addCard() {
    const deck = cardDeck ?? decks?.[0]?.id;
    if (!deck) return setProblem("Create a deck first.");
    const v = checkCard(front, back);
    if (typeof v === "string") return setProblem(v);
    if (!wsId) return setProblem("Could not find your workspace.");
    if (saving) return;
    setSaving(true);
    setProblem(null);
    const { error } = await supabase
      .from("flashcards")
      .insert({ workspace_id: wsId, deck_id: deck, front: v.front, back: v.back });
    setSaving(false);
    if (error) return setProblem("Could not add the card.");
    setFront("");
    setBack("");
    load();
  }

  function startStudy(deckId: string | null) {
    setStudyDeck(deckId);
    setSkipped([]);
    setReviewed(0);
    setShown(false);
    setProblem(null);
    setMode("study");
  }

  const header = (
    <ScreenHeader
      title="Flashcards"
      onBack={mode === "list" ? onBack : () => setMode("list")}
      action={{ label: "More", onPress: onOpenWeb }}
    />
  );

  if (mode === "study") {
    return (
      <View style={{ flex: 1 }}>
        {header}
        <ScrollView contentContainerStyle={s.page}>
          {current ? (
            <View>
              <Text style={s.muted}>
                {queue.length} due{reviewed ? ` · ${reviewed} reviewed` : ""}
              </Text>
              <Pressable style={s.bigCard} onPress={() => setShown(true)}>
                <Text style={s.label}>Question</Text>
                <Text style={s.big}>{current.front}</Text>
                {shown ? (
                  <>
                    <Text style={[s.label, { marginTop: 18 }]}>Answer</Text>
                    <Text style={s.big}>{current.back}</Text>
                  </>
                ) : (
                  <Text style={[s.muted, { marginTop: 18 }]}>Tap to show the answer</Text>
                )}
              </Pressable>
              {problem && <Text style={s.error}>{problem}</Text>}
              {shown ? (
                <View style={s.row}>
                  {RATINGS.map((r) => (
                    <Pressable
                      key={r.value}
                      style={[s.rate, saving && { opacity: 0.5 }]}
                      disabled={saving}
                      onPress={() => rate(current, r.value)}
                    >
                      <Text style={s.btnText}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Pressable style={s.ghost} onPress={() => setSkipped((x) => [...x, current.id])}>
                  <Text style={s.ghostText}>Skip for now</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.title}>All caught up</Text>
              <Text style={s.meta}>
                {reviewed ? `You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}. ` : ""}
                No more cards are due{skipped.length ? " (skipped cards stay due)" : ""}.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {header}
      <ScrollView
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {failed && <Text style={s.error}>Could not load flashcards. Pull down to retry.</Text>}
        {decks === null && !failed && <ActivityIndicator color={C.primary} />}

        {decks && mode === "list" && (
          <>
            <Pressable
              style={[s.addBtn, totalDue === 0 && { opacity: 0.5 }]}
              disabled={totalDue === 0}
              onPress={() => startStudy(null)}
            >
              <Text style={s.btnText}>
                {totalDue
                  ? `Study ${totalDue} due card${totalDue === 1 ? "" : "s"}`
                  : "Nothing due"}
              </Text>
            </Pressable>
            <View style={s.row}>
              <Pressable
                style={s.ghost}
                onPress={() => {
                  setProblem(null);
                  setMode("addCard");
                }}
              >
                <Text style={s.ghostText}>+ Card</Text>
              </Pressable>
              <Pressable
                style={s.ghost}
                onPress={() => {
                  setProblem(null);
                  setMode("addDeck");
                }}
              >
                <Text style={s.ghostText}>+ Deck</Text>
              </Pressable>
            </View>
            {decks.length === 0 && (
              <Text style={s.muted}>No decks yet. Create one with + Deck.</Text>
            )}
            {counts.map(({ deck, total, due }) => (
              <View key={deck.id} style={s.card}>
                <Text style={s.title}>{deck.name}</Text>
                <Text style={s.meta}>
                  {total} card{total === 1 ? "" : "s"} · {due} due
                </Text>
                {due > 0 && (
                  <Pressable
                    style={[s.ghost, { marginTop: 10 }]}
                    onPress={() => startStudy(deck.id)}
                  >
                    <Text style={s.ghostText}>Study this deck</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </>
        )}

        {mode === "addDeck" && (
          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder="Deck name"
              placeholderTextColor={C.muted}
              value={deckName}
              onChangeText={setDeckName}
              autoFocus
            />
            {problem && <Text style={s.error}>{problem}</Text>}
            <Pressable
              style={[s.btn, saving && { opacity: 0.5 }]}
              disabled={saving}
              onPress={addDeck}
            >
              <Text style={s.btnText}>Create deck</Text>
            </Pressable>
          </View>
        )}

        {mode === "addCard" && decks && (
          <View style={s.card}>
            {decks.length === 0 ? (
              <Text style={s.muted}>Create a deck first.</Text>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chips}
                >
                  {decks.map((d) => {
                    const on = (cardDeck ?? decks[0]!.id) === d.id;
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => setCardDeck(d.id)}
                        style={[s.chip, on && s.chipOn]}
                      >
                        <Text style={[s.chipText, on && s.chipTextOn]}>{d.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <TextInput
                  style={[s.input, { minHeight: 70, textAlignVertical: "top" }]}
                  placeholder="Question"
                  placeholderTextColor={C.muted}
                  value={front}
                  onChangeText={setFront}
                  multiline
                />
                <TextInput
                  style={[s.input, { minHeight: 70, textAlignVertical: "top" }]}
                  placeholder="Answer"
                  placeholderTextColor={C.muted}
                  value={back}
                  onChangeText={setBack}
                  multiline
                />
                {problem && <Text style={s.error}>{problem}</Text>}
                <Pressable
                  style={[s.btn, saving && { opacity: 0.5 }]}
                  disabled={saving}
                  onPress={addCard}
                >
                  <Text style={s.btnText}>Add card</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  chips: { gap: 8, paddingBottom: 10 },
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
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  btn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  rate: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  ghost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  ghostText: { color: C.primary, fontWeight: "600", fontSize: 13 },
  row: { flexDirection: "row", gap: 8, marginBottom: 12 },
  error: { color: C.danger, marginBottom: 8 },
  muted: { color: C.muted, marginBottom: 8 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  bigCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 20,
    minHeight: 220,
    marginBottom: 14,
  },
  label: { color: C.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  big: { color: C.text, fontSize: 18, lineHeight: 26, marginTop: 6 },
  title: { color: C.text, fontWeight: "700", fontSize: 15 },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
});
