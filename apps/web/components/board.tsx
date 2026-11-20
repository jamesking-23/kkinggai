"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Settings2 } from "lucide-react";
import { loadBoardPrefs, saveBoardPrefs } from "../app/(app)/chess/board-prefs-actions";
import { PREFS_AT_KEY, decideSync } from "../lib/board-sync";
import {
  BOARD_MAX,
  BOARD_MIN,
  BOARD_THEMES,
  DEFAULT_PREFS,
  PIECE_SETS,
  PREFS_KEY,
  parsePrefs,
  pieceCode,
  readableOn,
  sanitizePrefs,
  squareColors,
  type BoardPrefs,
} from "../lib/board-prefs";

// ---- preferences, kept in this browser's local storage and shared by every board on the page ----
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: BoardPrefs = DEFAULT_PREFS;

function readRaw(): string | null {
  try {
    return localStorage.getItem(PREFS_KEY);
  } catch {
    return null;
  }
}
function snapshot(): BoardPrefs {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parsePrefs(raw);
  }
  return cached;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}
// ---- sync across devices: last write wins through the user's settings row; failures leave the local copy alone ----
let syncChecked = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function localAt(): number {
  try {
    return Number(localStorage.getItem(PREFS_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeLocal(next: BoardPrefs, at: number) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    localStorage.setItem(PREFS_AT_KEY, String(at));
  } catch {
    cachedRaw = undefined;
    cached = next;
  }
  listeners.forEach((l) => l());
}
async function syncOnce() {
  if (syncChecked) return;
  syncChecked = true;
  try {
    const remote = await loadBoardPrefs();
    const action = decideSync(localAt(), remote?.at ?? 0);
    if (action === "pull" && remote) writeLocal(remote.prefs, remote.at);
    else if (action === "push") await saveBoardPrefs(snapshot(), localAt());
  } catch {
    syncChecked = false; // try again on the next mount
  }
}
function scheduleSave(next: BoardPrefs, at: number) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveBoardPrefs(next, at).catch(() => {});
  }, 800);
}

export function useBoardPrefs(): [BoardPrefs, (patch: Partial<BoardPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PREFS);
  useEffect(() => {
    void syncOnce();
  }, []);
  const update = useCallback((patch: Partial<BoardPrefs>) => {
    const next = sanitizePrefs({ ...snapshot(), ...patch });
    const at = Date.now();
    scheduleSave(next, at);
    try {
      localStorage.setItem(PREFS_AT_KEY, String(at));
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the change lasts until reload
      cachedRaw = undefined;
      cached = next;
    }
    listeners.forEach((l) => l());
  }, []);
  return [prefs, update];
}

export type BoardProps = {
  /** 8x8 glyph grid, already flipped for the viewer (rank shown first). */
  rows: string[][];
  /** Square name ("e4") for a displayed row and column. */
  square: (r: number, c: number) => string;
  label: string;
  onSquare?: (square: string, glyph: string) => void;
  disabled?: boolean;
  selected?: string | null;
  last?: { from: string; to: string } | null;
  /** Squares the selected piece can move to. Drawn only when the "move hints" option is on. */
  targets?: ReadonlySet<string>;
  busy?: boolean;
  /** Slide a piece from its old square when `last` changes. Off for stepping through a game. Default on. */
  animate?: boolean;
  /** Rendered above and below the board, inside its width. */
  before?: ReactNode;
  after?: ReactNode;
};

/** The shared chess board: size, square colours and piece set come from the viewer's saved preferences. */
export function Board(props: BoardProps) {
  const [prefs, setPrefs] = useBoardPrefs();
  const [open, setOpen] = useState(false);
  const { light, dark } = squareColors(prefs);
  const interactive = !!props.onSquare;
  const flipped = props.square(0, 0) !== "a8";
  const frame = useRef<HTMLDivElement>(null);

  // ---- drag and drop (mouse, touch and pen). Clicking still works: a press on a piece acts as a click on it. ----
  const [drag, setDrag] = useState<{ from: string; glyph: string; x: number; y: number } | null>(
    null,
  );
  const dragRef = useRef<{ from: string; sx: number; sy: number; moved: boolean } | null>(null);
  const dropped = useRef<{ to: string; at: number } | null>(null);
  const onSquareRef = useRef(props.onSquare);
  onSquareRef.current = props.onSquare;
  const glyphAt = useCallback(
    (square: string) => {
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) if (props.square(r, c) === square) return props.rows[r]![c]!;
      return "";
    },
    [props],
  );

  function startDrag(e: React.PointerEvent, square: string, glyph: string) {
    if (e.button !== 0 || !props.onSquare || props.disabled || !glyph) return;
    dragRef.current = { from: square, sx: e.clientX, sy: e.clientY, moved: false };
    // Acts like a click: selects the piece, or captures with the selected one. Pressing the piece that is
    // already selected waits for the release, so it can be dragged without being deselected first.
    const wasSelected = props.selected === square;
    if (!wasSelected) props.onSquare(square, glyph);
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < 5) return;
      d.moved = true;
      setDrag({ from: d.from, glyph, x: ev.clientX, y: ev.clientY });
    };
    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d && !d.moved && wasSelected && ev.type === "pointerup")
        onSquareRef.current?.(square, glyph);
      if (!d?.moved || ev.type === "pointercancel") return;
      const el = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>("[data-square]");
      const to = el?.dataset.square;
      if (to && to !== d.from && frame.current?.contains(el)) {
        dropped.current = { to, at: Date.now() };
        onSquareRef.current?.(to, glyphAt(to));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  // ---- slide the moved piece from its old square ----
  const lastKey = props.last ? `${props.last.from}${props.last.to}` : "";
  const prevKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const first = prevKey.current === null;
    const changed = prevKey.current !== lastKey;
    prevKey.current = lastKey;
    if (first || !changed || !lastKey || props.animate === false) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const { from, to } = props.last!;
    const d = dropped.current;
    if (d && d.to === to && Date.now() - d.at < 4000) return; // the player just dragged it there
    const root = frame.current;
    const piece = root?.querySelector<HTMLElement>(`[data-square="${to}"] .board-piece`);
    const fromEl = root?.querySelector<HTMLElement>(`[data-square="${from}"]`);
    const toEl = root?.querySelector<HTMLElement>(`[data-square="${to}"]`);
    if (!piece || !fromEl || !toEl || !piece.animate) return;
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    piece.animate(
      [
        { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)`, zIndex: 5 },
        { transform: "translate(0, 0)", zIndex: 5 },
      ],
      { duration: 200, easing: "cubic-bezier(0.22, 0.8, 0.3, 1)" },
    );
  }, [lastKey, props]);

  useEffect(() => () => void (dragRef.current = null), []);

  return (
    <div style={{ width: prefs.size, maxWidth: "100%" }}>
      {props.before}
      <div
        ref={frame}
        role="group"
        aria-label={props.label}
        className={`board-frame grid grid-cols-8 overflow-hidden rounded-xl ${props.busy ? "opacity-70" : ""}`}
        style={{ containerType: "inline-size" }}
      >
        {props.rows.flatMap((row, r) =>
          row.map((glyph, c) => {
            const s = props.square(r, c);
            const isDark = (r + c) % 2 === 1;
            const base = isDark ? dark : light;
            const code = pieceCode(glyph);
            const isLast = !!props.last && (props.last.from === s || props.last.to === s);
            const isSel = props.selected === s;
            const isTarget = prefs.hints && !!props.targets?.has(s);
            const showFile = prefs.coordinates && r === 7;
            const showRank = prefs.coordinates && c === 0;
            const coord = readableOn(base);
            const cell = (
              <>
                {(isLast || isSel) && (
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      background: isSel ? "rgba(255, 214, 10, 0.55)" : "rgba(255, 214, 10, 0.32)",
                    }}
                  />
                )}
                {showRank && (
                  <span
                    aria-hidden
                    className="absolute left-[4%] top-[3%] font-semibold leading-none"
                    style={{ color: coord, fontSize: "2.6cqw", opacity: 0.8 }}
                  >
                    {s[1]}
                  </span>
                )}
                {showFile && (
                  <span
                    aria-hidden
                    className="absolute bottom-[3%] right-[5%] font-semibold leading-none"
                    style={{ color: coord, fontSize: "2.6cqw", opacity: 0.8 }}
                  >
                    {s[0]}
                  </span>
                )}
                {isTarget && (
                  <span
                    aria-hidden
                    className="absolute rounded-full"
                    style={
                      glyph
                        ? {
                            inset: "4%",
                            border: "0.9cqw solid rgba(20, 20, 20, 0.28)",
                            background: "transparent",
                          }
                        : { width: "30%", height: "30%", background: "rgba(20, 20, 20, 0.26)" }
                    }
                  />
                )}
                {code &&
                  (prefs.pieces === "glyphs" ? (
                    <span
                      className="board-piece relative leading-none"
                      style={{
                        opacity: drag?.from === s ? 0.3 : 1,
                        fontSize: "9.6cqw",
                        color: code[0] === "w" ? "#fffdf6" : "#15120e",
                        textShadow:
                          code[0] === "w"
                            ? "0 0 1px #000, 0 0 2px #000, 0 1px 2px rgba(0,0,0,.5)"
                            : "0 0 1px rgba(255,255,255,.35)",
                      }}
                    >
                      {code[0] === "w" ? glyph.replace(/./u, (g) => WHITE_TO_SOLID[g] ?? g) : glyph}
                    </span>
                  ) : (
                    <img
                      src={`/pieces/${prefs.pieces}/${code}.svg`}
                      alt=""
                      draggable={false}
                      className="board-piece relative h-[94%] w-[94%] select-none"
                      style={{ opacity: drag?.from === s ? 0.3 : 1 }}
                    />
                  ))}
              </>
            );
            const cls = `relative flex aspect-square items-center justify-center ${drag ? "" : "overflow-hidden"}`;
            const aria = `${s}${code ? ` ${pieceName(code)}` : ""}`;
            return interactive ? (
              <button
                key={s}
                type="button"
                data-square={s}
                // Presses on pieces are handled by the pointer events; this covers empty squares and the keyboard.
                onClick={(e) => {
                  if (glyph && e.detail !== 0) return;
                  props.onSquare?.(s, glyph);
                }}
                onPointerDown={(e) => startDrag(e, s, glyph)}
                disabled={props.disabled}
                aria-label={aria}
                className={`${cls} board-square`}
                style={{ background: base, touchAction: glyph ? "none" : undefined }}
              >
                {cell}
              </button>
            ) : (
              <div
                key={s}
                data-square={s}
                className={cls}
                style={{ background: base }}
                aria-label={aria}
              >
                {cell}
              </div>
            );
          }),
        )}
      </div>
      {drag && <DragGhost drag={drag} frame={frame} set={prefs.pieces} />}
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted transition hover:bg-raised hover:text-text"
        >
          <Settings2 size={14} /> Customise board
        </button>
        <span className="text-xs text-muted">{flipped ? "Black at the bottom" : ""}</span>
      </div>
      {open && <BoardSettings prefs={prefs} set={setPrefs} />}
      {props.after}
    </div>
  );
}

const WHITE_TO_SOLID: Record<string, string> = {
  "♔": "♚",
  "♕": "♛",
  "♖": "♜",
  "♗": "♝",
  "♘": "♞",
  "♙": "♟",
};
const NAMES: Record<string, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};
function pieceName(code: string) {
  return `${code[0] === "w" ? "white" : "black"} ${NAMES[code[1]!]}`;
}

const SIZES = [
  ["S", 340],
  ["M", 460],
  ["L", 600],
  ["XL", 760],
  ["Max", BOARD_MAX],
] as const;

function BoardSettings({
  prefs,
  set,
}: {
  prefs: BoardPrefs;
  set: (p: Partial<BoardPrefs>) => void;
}) {
  return (
    <div className="surface-raised mt-2 space-y-5 rounded-xl p-4 text-sm">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">Size</h3>
          <span className="text-xs text-muted">{prefs.size}px</span>
        </div>
        <input
          type="range"
          min={BOARD_MIN}
          max={BOARD_MAX}
          step={10}
          value={prefs.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
          aria-label="Board size"
          className="w-full accent-[var(--color-primary)]"
        />
        <div className="mt-2 flex gap-1.5">
          {SIZES.map(([name, px]) => (
            <button
              key={name}
              type="button"
              onClick={() => set({ size: px })}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                prefs.size === px
                  ? "border-primary bg-primary/15 text-text"
                  : "border-border text-muted hover:bg-raised hover:text-text"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          The board never grows wider than the space it has, so large sizes shrink to fit a phone.
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-medium">Board colours</h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {BOARD_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ theme: t.id })}
              aria-pressed={prefs.theme === t.id}
              className={`rounded-lg border p-1.5 text-left text-xs transition ${
                prefs.theme === t.id
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-muted"
              }`}
            >
              <Swatch light={t.light} dark={t.dark} />
              <span className="mt-1 block truncate">{t.name}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => set({ theme: "custom" })}
            aria-pressed={prefs.theme === "custom"}
            className={`rounded-lg border p-1.5 text-left text-xs transition ${
              prefs.theme === "custom"
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-muted"
            }`}
          >
            <Swatch light={prefs.customLight} dark={prefs.customDark} />
            <span className="mt-1 block">Custom</span>
          </button>
        </div>
        {prefs.theme === "custom" && (
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-muted">
              Light squares
              <input
                type="color"
                value={prefs.customLight}
                onChange={(e) => set({ customLight: e.target.value })}
                aria-label="Light square colour"
                className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              Dark squares
              <input
                type="color"
                value={prefs.customDark}
                onChange={(e) => set({ customDark: e.target.value })}
                aria-label="Dark square colour"
                className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-medium">Pieces</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PIECE_SETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => set({ pieces: p.id })}
              aria-pressed={prefs.pieces === p.id}
              title={p.credit}
              className={`rounded-lg border p-1.5 text-center text-xs transition ${
                prefs.pieces === p.id
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-muted"
              }`}
            >
              <span
                className="mx-auto flex h-12 items-center justify-center rounded"
                style={{ background: squareColors(prefs).dark }}
              >
                {p.id === "glyphs" ? (
                  <span
                    className="text-3xl leading-none"
                    style={{ color: "#fffdf6", textShadow: "0 0 2px #000" }}
                  >
                    ♞
                  </span>
                ) : (
                  <img
                    src={`/pieces/${p.id}/wN.svg`}
                    alt=""
                    className="h-11 w-11"
                    draggable={false}
                  />
                )}
              </span>
              <span className="mt-1 block truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.coordinates}
            onChange={(e) => set({ coordinates: e.target.checked })}
            className="accent-[var(--color-primary)]"
          />
          Show coordinates
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.hints}
            onChange={(e) => set({ hints: e.target.checked })}
            className="accent-[var(--color-primary)]"
          />
          Show legal-move hints
        </label>
      </section>

      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>Saved in this browser only.</span>
        <button
          type="button"
          onClick={() => set({ ...DEFAULT_PREFS })}
          className="rounded-md border border-border px-2.5 py-1 hover:bg-raised hover:text-text"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Swatch({ light, dark }: { light: string; dark: string }) {
  return (
    <span className="grid h-10 grid-cols-4 overflow-hidden rounded" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} style={{ background: (i + Math.floor(i / 4)) % 2 === 0 ? light : dark }} />
      ))}
    </span>
  );
}

/** The piece that follows the pointer while it is being dragged. */
function DragGhost({
  drag,
  frame,
  set,
}: {
  drag: { glyph: string; x: number; y: number };
  frame: React.RefObject<HTMLDivElement | null>;
  set: string;
}) {
  const size = ((frame.current?.getBoundingClientRect().width ?? 400) / 8) * 1.05;
  const code = pieceCode(drag.glyph);
  if (!code) return null;
  const style = {
    position: "fixed" as const,
    left: drag.x - size / 2,
    top: drag.y - size / 2,
    width: size,
    height: size,
    pointerEvents: "none" as const,
    zIndex: 50,
    filter: "drop-shadow(0 8px 10px rgba(0,0,0,.45))",
  };
  return set === "glyphs" ? (
    <span
      aria-hidden
      className="flex items-center justify-center leading-none"
      style={{
        ...style,
        fontSize: size * 0.85,
        color: code[0] === "w" ? "#fffdf6" : "#15120e",
        textShadow: code[0] === "w" ? "0 0 2px #000" : "none",
      }}
    >
      {code[0] === "w" ? (WHITE_TO_SOLID[drag.glyph] ?? drag.glyph) : drag.glyph}
    </span>
  ) : (
    <img src={`/pieces/${set}/${code}.svg`} alt="" draggable={false} style={style} />
  );
}

/** A piece picture in the viewer's chosen piece set, for use outside the board (for example a promotion menu). */
export function PieceIcon({ code, size = 44 }: { code: string; size?: number }) {
  const [prefs] = useBoardPrefs();
  const glyphs: Record<string, string> = {
    wQ: "♛",
    wR: "♜",
    wB: "♝",
    wN: "♞",
    bQ: "♛",
    bR: "♜",
    bB: "♝",
    bN: "♞",
  };
  return prefs.pieces === "glyphs" ? (
    <span
      aria-hidden
      className="leading-none"
      style={{
        fontSize: size * 0.85,
        color: code[0] === "w" ? "#fffdf6" : "#15120e",
        textShadow: code[0] === "w" ? "0 0 2px #000" : "none",
      }}
    >
      {glyphs[code] ?? ""}
    </span>
  ) : (
    <img
      src={`/pieces/${prefs.pieces}/${code}.svg`}
      alt=""
      width={size}
      height={size}
      draggable={false}
    />
  );
}
