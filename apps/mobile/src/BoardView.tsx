import { memo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { pieceCode, themeFor } from "./boardPrefs";
import { useBoardPrefs } from "./boardPrefsStore";
import { fenToLetters, orient, squareAt } from "./chessPuzzles";
import { PIECE_SETS, type PieceCode } from "./chessPieceSets";

const Piece = memo(function Piece({ xml, size }: { xml: string; size: number }) {
  return <SvgXml xml={xml} width={size} height={size} />;
});

/** A chess board drawn from a FEN with SVG pieces, sized to the screen width. Optional tapping, selection, legal-target dots and last-move highlight. */
export function BoardView({
  fen,
  flip,
  label,
  selected,
  targets,
  last,
  onSquare,
}: {
  fen: string;
  flip: boolean;
  label: string;
  selected?: string | null;
  targets?: Set<string>;
  last?: { from: string; to: string } | null;
  onSquare?: (square: string) => void;
}) {
  const { width } = useWindowDimensions();
  const prefs = useBoardPrefs();
  const theme = themeFor(prefs.theme);
  const set = PIECE_SETS[prefs.pieces] ?? PIECE_SETS.classic!;
  const size = Math.floor((width - 32) / 8);
  const grid = orient(fenToLetters(fen), flip);
  const coord = Math.max(9, Math.round(size * 0.22));
  return (
    <View
      style={{
        width: size * 8,
        height: size * 8,
        alignSelf: "center",
        borderRadius: 6,
        overflow: "hidden",
      }}
      accessibilityLabel={label}
    >
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((cell, c) => {
            const sq = squareAt(r, c, flip);
            const dark = (r + c) % 2 === 1;
            const hot = selected === sq || last?.from === sq || last?.to === sq;
            const base = dark ? theme.dark : theme.light;
            const ink = dark ? theme.light : theme.dark;
            return (
              <Pressable
                key={sq}
                onPress={onSquare ? () => onSquare(sq) : undefined}
                disabled={!onSquare}
                accessibilityLabel={sq}
                style={{
                  width: size,
                  height: size,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: base,
                }}
              >
                {hot && (
                  <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, { backgroundColor: theme.hot, opacity: 0.75 }]}
                  />
                )}
                {prefs.coordinates && c === 0 && (
                  <Text style={[s.coord, { top: 1, left: 2, color: ink, fontSize: coord }]}>
                    {sq[1]}
                  </Text>
                )}
                {prefs.coordinates && r === 7 && (
                  <Text style={[s.coord, { bottom: 0, right: 2, color: ink, fontSize: coord }]}>
                    {sq[0]}
                  </Text>
                )}
                {targets?.has(sq) && <View style={[s.dot, cell !== "" && s.ring]} />}
                {cell !== "" && (
                  <Piece xml={set[pieceCode(cell) as PieceCode]} size={Math.round(size * 0.94)} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  coord: { position: "absolute", fontWeight: "700", opacity: 0.85 },
  dot: {
    position: "absolute",
    width: "28%",
    height: "28%",
    borderRadius: 99,
    backgroundColor: "rgba(20,20,20,0.35)",
  },
  ring: {
    width: "92%",
    height: "92%",
    backgroundColor: "transparent",
    borderWidth: 3,
    borderColor: "rgba(20,20,20,0.35)",
  },
});
