// A small, safe arithmetic evaluator (no eval). Supports + - * / ^ % and parentheses, and "N% of M".

export class CalcError extends Error {}

type Tok = { t: "num"; v: number } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === " ") i++;
    else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++;
      const n = Number(src.slice(i, j));
      if (!Number.isFinite(n)) throw new CalcError("That number does not look right.");
      out.push({ t: "num", v: n });
      i = j;
    } else if ("+-*/^()%".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else throw new CalcError("I can only do numbers and + - * / ^ % ( ).");
  }
  return out;
}

/** Evaluates an arithmetic expression. Throws CalcError on bad input or division by zero. */
export function evaluate(src: string): number {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => {
    const t = peek();
    return t?.t === "op" && t.v === v;
  };

  function primary(): number {
    const t = toks[p++];
    if (!t) throw new CalcError("The expression ends too early.");
    if (t.t === "num") {
      let v = t.v;
      while (isOp("%")) {
        p++;
        v /= 100;
      }
      return v;
    }
    if (t.v === "(") {
      const v = expr();
      if (!isOp(")")) throw new CalcError("A bracket is not closed.");
      p++;
      return v;
    }
    if (t.v === "-") return -power();
    if (t.v === "+") return power();
    throw new CalcError("The expression is not valid.");
  }
  function power(): number {
    const base = primary();
    if (isOp("^")) {
      p++;
      return base ** power();
    }
    return base;
  }
  function term(): number {
    let v = power();
    while (isOp("*") || isOp("/")) {
      const op = (toks[p++] as { v: string }).v;
      const r = power();
      if (op === "/" && r === 0) throw new CalcError("Cannot divide by zero.");
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[p++] as { v: string }).v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  const result = expr();
  if (p < toks.length) throw new CalcError("The expression is not valid.");
  if (!Number.isFinite(result)) throw new CalcError("That result is too large.");
  return result;
}

const WORDS: [RegExp, string][] = [
  [/\bplus\b|\badd(?:ed)?\b(?= \d)/g, "+"],
  [/\bminus\b|\bsubtract(?:ed)?\b|\btake away\b/g, "-"],
  [/\bmultiplied by\b|\btimes\b|\bmultiply\b/g, "*"],
  [/\bdivided by\b|\bover\b|\bdivide\b/g, "/"],
  [/\bto the power of\b|\bpower\b/g, "^"],
  [/(\d)\s*x\s*(?=\d)/g, "$1*"],
];

/** Pulls the arithmetic out of a sentence ("what is 15% of 200 plus 3?"). Returns null if there is none. */
export function extractExpression(message: string): string | null {
  let s = message.toLowerCase().replace(/,(?=\d{3}\b)/g, "");
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:%|percent|per cent)\s*of\s*(\d+(?:\.\d+)?)/g, "($1%*$2)");
  for (const [re, to] of WORDS) s = s.replace(re, to);
  const runs = s.match(/[\d.()+\-*/^%\s]{3,}/g) ?? [];
  const best = runs
    .map((r) => r.trim())
    .filter((r) => /\d/.test(r) && /[+\-*/^%]/.test(r))
    .sort((a, b) => b.length - a.length)[0];
  return best ?? null;
}

/** Tidy number for display: up to 8 significant decimals, thousands separators. */
export function formatNumber(n: number): string {
  const rounded = Math.round(n * 1e8) / 1e8;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 8 });
}
