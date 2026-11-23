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
import { localDate, safeZone } from "./agenda";
import {
  formatMoney,
  monthLabel,
  monthly,
  parseAmount,
  stageLabel,
  totals,
  type EntryRow,
  type VentureRow,
} from "./business";
import { cleanLine } from "./career";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

/** Native business: each venture's income, expenses and net with the last three months, and a quick income or expense entry dated today. Creating ventures, tasks, contacts and removing entries stay on the website. */
export function BusinessScreen({
  onBack,
  onOpenWeb,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
}) {
  const [ventures, setVentures] = useState<VentureRow[] | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [today, setToday] = useState("");
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [kind, setKind] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const settings = await supabase.from("user_settings").select("timezone").maybeSingle();
    setToday(localDate(new Date().toISOString(), safeZone(settings.data?.timezone)));
    const [v, e] = await Promise.all([
      supabase
        .from("ventures")
        .select("id, name, stage, currency")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .overrideTypes<VentureRow[]>(),
      supabase
        .from("venture_entries")
        .select("id, venture_id, kind, amount, occurred_on, category, description")
        .is("deleted_at", null)
        .order("occurred_on", { ascending: false })
        .limit(2000)
        .overrideTypes<EntryRow[]>(),
    ]);
    if (v.error || e.error) return setFailed(true);
    setVentures(v.data ?? []);
    setEntries(e.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byVenture = useMemo(() => {
    const m = new Map<string, EntryRow[]>();
    for (const e of entries) m.set(e.venture_id, [...(m.get(e.venture_id) ?? []), e]);
    return m;
  }, [entries]);

  async function save(ventureId: string) {
    const value = parseAmount(amount);
    if (value === null)
      return setProblem(
        "Enter an amount above 0 with at most two decimals, for example 15000 or 12.50.",
      );
    if (saving) return;
    setSaving(true);
    setProblem(null);
    const { error } = await supabase.from("venture_entries").insert({
      venture_id: ventureId,
      kind,
      amount: value,
      occurred_on: today,
      category: cleanLine(category, 60),
      description: "",
    });
    setSaving(false);
    if (error) return setProblem("Could not save the entry. Check your connection.");
    setAmount("");
    setCategory("");
    setAdding(null);
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Business"
        onBack={onBack}
        action={{ label: "More", onPress: onOpenWeb }}
      />
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
        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load your ventures. Pull down to retry.</Text>}
        {ventures === null && !failed && (
          <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />
        )}
        {ventures?.length === 0 && (
          <Text style={s.muted}>No ventures yet. Create one on the website.</Text>
        )}
        {ventures?.map((v) => {
          const mine = byVenture.get(v.id) ?? [];
          const t = totals(mine);
          const months = monthly(mine);
          return (
            <View key={v.id} style={s.card}>
              <View style={s.top}>
                <Text style={s.name}>{v.name}</Text>
                <Text style={s.badge}>{stageLabel(v.stage)}</Text>
              </View>
              <View style={s.figures}>
                <Figure label="Income" value={formatMoney(t.income, v.currency)} />
                <Figure label="Expenses" value={formatMoney(t.expense, v.currency)} />
                <Figure
                  label="Net"
                  value={formatMoney(t.net, v.currency)}
                  color={t.net < 0 ? C.danger : t.net > 0 ? "#15803d" : C.text}
                />
              </View>
              {months.map((m) => (
                <Text key={m.month} style={s.month}>
                  {monthLabel(m.month)}: in {formatMoney(m.income, v.currency)}, out{" "}
                  {formatMoney(m.expense, v.currency)}, net {formatMoney(m.net, v.currency)}
                </Text>
              ))}
              {adding === v.id ? (
                <View style={{ marginTop: 12 }}>
                  <View style={s.row}>
                    {(["income", "expense"] as const).map((k) => (
                      <Pressable
                        key={k}
                        onPress={() => setKind(k)}
                        style={[s.seg, kind === k && s.segOn]}
                      >
                        <Text style={[s.segText, kind === k && s.segTextOn]}>
                          {k === "income" ? "Income" : "Expense"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={s.input}
                    placeholder={`Amount (${v.currency})`}
                    placeholderTextColor={C.muted}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                  <TextInput
                    style={s.input}
                    placeholder="Category (optional)"
                    placeholderTextColor={C.muted}
                    value={category}
                    onChangeText={setCategory}
                  />
                  <View style={s.row}>
                    <Pressable
                      style={[s.btn, saving && { opacity: 0.5 }]}
                      disabled={saving}
                      onPress={() => save(v.id)}
                    >
                      <Text style={s.btnText}>Save for today</Text>
                    </Pressable>
                    <Pressable style={s.ghost} onPress={() => setAdding(null)}>
                      <Text style={s.ghostText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={[s.ghost, { marginTop: 12, alignSelf: "flex-start" }]}
                  onPress={() => {
                    setAdding(v.id);
                    setProblem(null);
                  }}
                >
                  <Text style={s.ghostText}>+ Add income or expense</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.figLabel}>{label}</Text>
      <Text style={[s.figValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  error: { color: C.danger, marginBottom: 8 },
  muted: { color: C.muted },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, color: C.text, fontWeight: "700", fontSize: 17 },
  badge: { color: C.primary, fontSize: 12, fontWeight: "700" },
  figures: { flexDirection: "row", gap: 8, marginTop: 12 },
  figLabel: { color: C.muted, fontSize: 11 },
  figValue: { color: C.text, fontWeight: "700", fontSize: 14, marginTop: 2 },
  month: { color: C.muted, fontSize: 12, marginTop: 6 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  seg: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  segOn: { backgroundColor: C.primary, borderColor: C.primary },
  segText: { color: C.text, fontWeight: "600" },
  segTextOn: { color: "#fff" },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    color: C.text,
  },
  btn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
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
