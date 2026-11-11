"use client";

import { Chess } from "chess.js";
import { parseInfo, whiteCp, type EngineScore } from "./analysis";

export const ENGINE_URL = "/engine/stockfish-19-lite-single.js";

export type PositionEval = {
  /** White's-view centipawns (mate scores map to ±(10000 − distance)). */
  white: number;
  bestUci: string | null;
  bestSan: string | null;
  depth: number;
};

/** Thin UCI wrapper around the Stockfish Web Worker. One position at a time. */
export class Engine {
  private worker: Worker;
  private onLine: ((line: string) => void) | null = null;

  constructor(url = ENGINE_URL) {
    this.worker = new Worker(url);
    this.worker.onmessage = (ev: MessageEvent) => this.onLine?.(String(ev.data));
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private waitFor(done: (line: string) => boolean, ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.onLine = null;
        reject(new Error("The engine did not respond in time"));
      }, ms);
      this.onLine = (line) => {
        if (done(line)) {
          clearTimeout(timer);
          this.onLine = null;
          resolve();
        }
      };
    });
  }

  async init() {
    const ok = this.waitFor((l) => l === "uciok", 30_000);
    this.send("uci");
    await ok;
    const ready = this.waitFor((l) => l === "readyok", 30_000);
    this.send("isready");
    await ready;
  }

  /** Evaluates one position to a fixed depth. */
  async evaluate(fen: string, depth: number): Promise<PositionEval> {
    const got: { score: EngineScore | null; reached: number; best: string | null } = {
      score: null,
      reached: 0,
      best: null,
    };
    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.onLine = null;
        this.send("stop");
        reject(new Error("The engine took too long on a position"));
      }, 60_000);
      this.onLine = (line) => {
        const info = parseInfo(line);
        if (info) {
          got.score = info.score;
          got.reached = info.depth;
        }
        const m = line.match(/^bestmove (\S+)/);
        if (m) {
          clearTimeout(timer);
          this.onLine = null;
          got.best = m[1] === "(none)" ? null : m[1]!;
          resolve();
        }
      };
    });
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    await done;
    const { score, reached, best } = got;
    if (!score) throw new Error("The engine returned no evaluation");
    const stm = fen.split(" ")[1] === "b" ? "b" : "w";
    let bestSan: string | null = null;
    if (best) {
      try {
        const c = new Chess(fen);
        bestSan = c.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] }).san;
      } catch {
        bestSan = null;
      }
    }
    return { white: whiteCp(score, stm), bestUci: best, bestSan, depth: reached };
  }

  stop() {
    this.send("stop");
  }

  terminate() {
    this.onLine = null;
    this.worker.terminate();
  }
}

/** Evaluates every position of a game. Positions where the game is over are scored without the engine. */
export async function analyseGame(
  fens: string[],
  depth: number,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<PositionEval[]> {
  const engine = new Engine();
  try {
    await engine.init();
    const out: PositionEval[] = [];
    for (let i = 0; i < fens.length; i++) {
      if (signal.aborted) throw new Error("Cancelled");
      const fen = fens[i]!;
      const c = new Chess(fen);
      if (c.isCheckmate()) {
        out.push({
          white: c.turn() === "w" ? -10000 : 10000,
          bestUci: null,
          bestSan: null,
          depth: 0,
        });
      } else if (c.isGameOver()) {
        out.push({ white: 0, bestUci: null, bestSan: null, depth: 0 });
      } else {
        out.push(await engine.evaluate(fen, depth));
      }
      onProgress(i + 1, fens.length);
    }
    return out;
  } finally {
    engine.terminate();
  }
}
