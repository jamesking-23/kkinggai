import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { fenToLetters, glyph, isWhitePiece, orient, squareAt } from "./chessPuzzles";

/** A chess board drawn from a FEN, sized to the screen width. Optional tapping, selection, legal-target dots and last-move highlight. */
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
  const size = Math.floor((width - 32) / 8);
  const grid = orient(fenToLetters(fen), flip);
  return (
    <View
      style={{ width: size * 8, height: size * 8, alignSelf: "center" }}
      accessibilityLabel={label}
    >
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((cell, c) => {
            const sq = squareAt(r, c, flip);
            const dark = (r + c) % 2 === 1;
            const hot = selected === sq || last?.from === sq || last?.to === sq;
            return (
              <Pressable
                key={sq}
                onPress={onSquare ? () => onSquare(sq) : undefined}
                disabled={!onSquare}
                style={{
                  width: size,
                  height: size,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: hot ? "#f2d36b" : dark ? "#b58863" : "#f0d9b5",
                }}
              >
                {targets?.has(sq) && <View style={[s.dot, cell !== "" && s.ring]} />}
                {cell !== "" && (
                  <Text
                    style={[
                      { fontSize: size * 0.78, lineHeight: size },
                      isWhitePiece(cell) ? s.white : s.black,
                    ]}
                  >
                    {glyph(cell)}
                  </Text>
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
  white: {
    color: "#ffffff",
    textShadowColor: "#000",
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
  black: { color: "#1a1a1a" },
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
