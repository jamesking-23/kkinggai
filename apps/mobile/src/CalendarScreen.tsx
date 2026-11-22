import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  buildAgenda,
  dayLabel,
  localDate,
  safeZone,
  type AgendaDay,
  type AgendaEvent,
  type AgendaTask,
} from "./agenda";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";

const DAYS_AHEAD = 31;

/** Native calendar: the next month as an agenda of events and tasks that are due, in the account's timezone. Read only for now; add and edit are on the website. */
export function CalendarScreen({
  onBack,
  onOpenWeb,
}: {
  onBack: () => void;
  onOpenWeb: () => void;
}) {
  const [days, setDays] = useState<AgendaDay[] | null>(null);
  const [tz, setTz] = useState("UTC");
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + (DAYS_AHEAD + 1) * 86_400_000).toISOString();
    const [settings, ev, tk] = await Promise.all([
      supabase.from("user_settings").select("timezone").maybeSingle(),
      supabase
        .from("events")
        .select("id, title, location, starts_at, ends_at")
        .is("deleted_at", null)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at")
        .overrideTypes<AgendaEvent[]>(),
      supabase
        .from("tasks")
        .select("id, title, due_at")
        .is("deleted_at", null)
        .in("status", ["todo", "in_progress"])
        .gte("due_at", from)
        .lt("due_at", to)
        .overrideTypes<AgendaTask[]>(),
    ]);
    if (ev.error || tk.error) return setFailed(true);
    const zone = safeZone(settings.data?.timezone);
    setTz(zone);
    setDays(buildAgenda(ev.data ?? [], tk.data ?? [], zone));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = localDate(new Date().toISOString(), tz);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Calendar"
        onBack={onBack}
        action={{ label: "Add / edit", onPress: onOpenWeb }}
      />
      <ScrollView
        contentContainerStyle={s.page}
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
        <Text style={s.muted}>
          Next {DAYS_AHEAD} days · times in {tz}
        </Text>
        {failed && <Text style={s.error}>Could not load the calendar. Pull down to retry.</Text>}
        {days === null && !failed && (
          <ActivityIndicator color={C.primary} style={{ marginTop: 24 }} />
        )}
        {days?.length === 0 && (
          <Text style={[s.muted, { marginTop: 16 }]}>Nothing scheduled in the next month.</Text>
        )}
        {days?.map((d) => (
          <View key={d.date} style={s.day}>
            <Text style={s.dayTitle}>
              {dayLabel(d.date, today)}
              <Text style={s.dayDate}>{d.date === today ? "" : `  ${d.date}`}</Text>
            </Text>
            {d.items.map((i) => (
              <View key={i.key} style={[s.item, i.kind === "task" && s.itemTask]}>
                <Text style={s.itemTitle} numberOfLines={2}>
                  {i.kind === "task" ? "☐ " : ""}
                  {i.title}
                </Text>
                {i.detail && <Text style={s.itemDetail}>{i.detail}</Text>}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  muted: { color: C.muted, fontSize: 13 },
  error: { color: C.danger, marginTop: 12 },
  day: { marginTop: 18 },
  dayTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 8 },
  dayDate: { fontSize: 12, fontWeight: "400", color: C.muted },
  item: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    borderLeftColor: C.primary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  itemTask: { borderLeftColor: C.muted },
  itemTitle: { color: C.text, fontWeight: "600" },
  itemDetail: { color: C.muted, fontSize: 12, marginTop: 2 },
});
