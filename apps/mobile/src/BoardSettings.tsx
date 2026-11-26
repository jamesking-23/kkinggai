import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { BOARD_THEMES, PIECE_SET_LIST } from "./boardPrefs";
import { updateBoardPrefs, useBoardPrefs } from "./boardPrefsStore";
import { PIECE_SETS } from "./chessPieceSets";
import { C } from "./theme";

/** Collapsible "Board" panel: colour theme, piece set and coordinates, saved on this phone. */
export function BoardSettings() {
  const [open, setOpen] = useState(false);
  const p = useBoardPrefs();
  return (
    <View style={s.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} style={s.head} accessibilityRole="button">
        <Text style={s.title}>Board look</Text>
        <Text style={s.muted}>{open ? "Hide ▴" : "Change ▾"}</Text>
      </Pressable>
      {open && (
        <View>
          <Text style={s.label}>Colours</Text>
          <View style={s.row}>
            {BOARD_THEMES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => void updateBoardPrefs({ theme: t.id })}
                accessibilityLabel={`${t.name} board`}
                style={[s.swatch, p.theme === t.id && s.on]}
              >
                <View style={{ flexDirection: "row" }}>
                  <View style={{ width: 22, height: 22, backgroundColor: t.light }} />
                  <View style={{ width: 22, height: 22, backgroundColor: t.dark }} />
                </View>
                <Text style={s.small}>{t.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>Pieces</Text>
          <View style={s.row}>
            {PIECE_SET_LIST.map((ps) => (
              <Pressable
                key={ps.id}
                onPress={() => void updateBoardPrefs({ pieces: ps.id })}
                accessibilityLabel={`${ps.name} pieces`}
                style={[s.swatch, p.pieces === ps.id && s.on]}
              >
                <View style={{ flexDirection: "row" }}>
                  <SvgXml xml={PIECE_SETS[ps.id]!.wN} width={32} height={32} />
                  <SvgXml xml={PIECE_SETS[ps.id]!.bQ} width={32} height={32} />
                </View>
                <Text style={s.small}>{ps.name}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[s.head, { marginTop: 10 }]}>
            <Text style={s.title}>Coordinates</Text>
            <Switch
              value={p.coordinates}
              onValueChange={(v) => void updateBoardPrefs({ coordinates: v })}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.card,
    padding: 12,
    marginBottom: 14,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: C.text, fontWeight: "700" },
  muted: { color: C.muted, fontSize: 13 },
  label: { color: C.muted, fontSize: 12, marginTop: 12, marginBottom: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: {
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 10,
    padding: 6,
    alignItems: "center",
    gap: 4,
  },
  on: { borderColor: C.primary },
  small: { color: C.text, fontSize: 11 },
});
