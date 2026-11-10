/**
 * A small bundled opening table: SAN move prefixes mapped to a name (and ECO code where confident).
 * This is a coarse classifier for statistics, not a full ECO database. The longest matching prefix wins.
 */
export type OpeningInfo = { name: string; eco?: string };

const TABLE: [string, OpeningInfo][] = [
  ["e4", { name: "King's Pawn Game", eco: "B00" }],
  ["d4", { name: "Queen's Pawn Game", eco: "A40" }],
  ["c4", { name: "English Opening", eco: "A10" }],
  ["Nf3", { name: "Réti Opening", eco: "A04" }],
  ["f4", { name: "Bird's Opening", eco: "A02" }],
  ["b3", { name: "Nimzo-Larsen Attack", eco: "A01" }],
  ["g3", { name: "King's Fianchetto Opening", eco: "A00" }],
  ["e4 e5", { name: "Open Game", eco: "C20" }],
  ["e4 e5 Nf3 Nc6 Bb5", { name: "Ruy Lopez", eco: "C60" }],
  ["e4 e5 Nf3 Nc6 Bc4", { name: "Italian Game", eco: "C50" }],
  ["e4 e5 Nf3 Nc6 Bc4 Bc5", { name: "Giuoco Piano", eco: "C53" }],
  ["e4 e5 Nf3 Nc6 Nc3 Nf6", { name: "Four Knights Game", eco: "C47" }],
  ["e4 e5 Nf3 Nc6 d4", { name: "Scotch Game", eco: "C44" }],
  ["e4 e5 Nf3 Nf6", { name: "Petrov's Defense", eco: "C42" }],
  ["e4 e5 Nf3 d6", { name: "Philidor Defense", eco: "C41" }],
  ["e4 e5 f4", { name: "King's Gambit", eco: "C30" }],
  ["e4 e5 Nc3", { name: "Vienna Game", eco: "C25" }],
  ["e4 c5", { name: "Sicilian Defense", eco: "B20" }],
  ["e4 c5 c3", { name: "Sicilian Defense: Alapin Variation", eco: "B22" }],
  [
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",
    { name: "Sicilian Defense: Najdorf Variation", eco: "B90" },
  ],
  ["e4 e6", { name: "French Defense", eco: "C00" }],
  ["e4 c6", { name: "Caro-Kann Defense", eco: "B10" }],
  ["e4 d5", { name: "Scandinavian Defense", eco: "B01" }],
  ["e4 d6 d4 Nf6 Nc3 g6", { name: "Pirc Defense", eco: "B07" }],
  ["e4 g6", { name: "Modern Defense", eco: "B06" }],
  ["e4 Nf6", { name: "Alekhine's Defense", eco: "B02" }],
  ["d4 d5", { name: "Queen's Pawn Game: Closed" }],
  ["d4 d5 c4", { name: "Queen's Gambit", eco: "D06" }],
  ["d4 d5 c4 e6", { name: "Queen's Gambit Declined", eco: "D30" }],
  ["d4 d5 c4 dxc4", { name: "Queen's Gambit Accepted", eco: "D20" }],
  ["d4 d5 c4 c6", { name: "Slav Defense", eco: "D10" }],
  ["d4 d5 Bf4", { name: "London System" }],
  ["d4 Nf6", { name: "Indian Defense", eco: "A45" }],
  ["d4 Nf6 Bg5", { name: "Trompowsky Attack", eco: "A45" }],
  ["d4 Nf6 c4 g6", { name: "King's Indian Defense", eco: "E60" }],
  ["d4 Nf6 c4 e6 Nc3 Bb4", { name: "Nimzo-Indian Defense", eco: "E20" }],
  ["d4 Nf6 c4 e6 Nf3 b6", { name: "Queen's Indian Defense", eco: "E12" }],
  ["d4 Nf6 c4 c5", { name: "Benoni Defense", eco: "A60" }],
  ["d4 f5", { name: "Dutch Defense", eco: "A80" }],
];

const BY_KEY = new Map(TABLE);
const MAX_PLIES = Math.max(...TABLE.map(([k]) => k.split(" ").length));

/** Classifies a game from its SAN move list (longest known prefix). Returns null for an empty list. */
export function classifyOpening(sans: string[]): OpeningInfo | null {
  for (let n = Math.min(sans.length, MAX_PLIES); n >= 1; n--) {
    const hit = BY_KEY.get(sans.slice(0, n).join(" "));
    if (hit) return hit;
  }
  return null;
}
