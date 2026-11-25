// Light markdown for assistant replies (the online AI answers in markdown). Pure, so it is tested without a screen.
// Supported: paragraphs, #-headings, bullet and numbered lists, ``` code blocks, **bold**, *italic*, `code`.

export type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type Block =
  | { type: "p"; spans: Span[] }
  | { type: "h"; spans: Span[] }
  | { type: "li"; marker: string; spans: Span[] }
  | { type: "code"; text: string };

/** Splits one line of text into styled spans. Unclosed markers are left as plain text. */
export function inline(text: string): Span[] {
  const out: Span[] = [];
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) out.push({ text: m[2], bold: true });
    else if (m[4] !== undefined) out.push({ text: m[4], code: true });
    else if (m[6] !== undefined) out.push({ text: m[6], italic: true });
    else if (m[8] !== undefined) out.push({ text: m[8], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

export function blocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ type: "p", spans: inline(para.join("\n")) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*```/.test(line)) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) body.push(lines[i++]!);
      out.push({ type: "code", text: body.join("\n") });
      continue;
    }
    const h = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      flush();
      out.push({ type: "h", spans: inline(h[1]!.trim()) });
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet || num) {
      flush();
      out.push({
        type: "li",
        marker: bullet ? "•" : `${num![1]}.`,
        spans: inline((bullet ? bullet[1]! : num![2]!).trim()),
      });
      continue;
    }
    if (line.trim() === "") flush();
    else para.push(line);
  }
  flush();
  return out;
}

/** How far a keyboard covers the bottom of a view: positive means "add this much padding". Both numbers are screen y. */
export function keyboardOverlap(viewBottom: number, keyboardTop: number): number {
  return Math.max(0, Math.round(viewBottom - keyboardTop));
}

/** First word of a display name, or "there". */
export function firstName(name: string | null | undefined): string {
  const w = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return w || "there";
}

export type Starter = { icon: string; label: string; send?: string; fill?: string };

/** Tappable starting points on the empty screen. `send` runs at once; `fill` puts text in the box for the user to finish. */
export const STARTERS: readonly Starter[] = [
  { icon: "✓", label: "Show my tasks", send: "my tasks" },
  { icon: "+", label: "Add a task…", fill: "Add task " },
  { icon: "∑", label: "Calculate 15% of 80000", send: "calculate 15% of 80000" },
  { icon: "↗", label: "My running report", send: "running report" },
];

/** Everything the + menu offers. */
export const COMMANDS: readonly Starter[] = [
  { icon: "?", label: "What can you do?", send: "help" },
  { icon: "✓", label: "My open tasks", send: "my tasks" },
  { icon: "◷", label: "Tasks due today", send: "tasks due today" },
  { icon: "+", label: "Add a task", fill: "Add task " },
  { icon: "✦", label: "Save an idea", fill: "Idea: " },
  { icon: "↻", label: "Habits today", send: "habits today" },
  { icon: "◎", label: "Goal progress", send: "goals progress" },
  { icon: "↗", label: "Running report", send: "running report" },
  { icon: "➜", label: "Log a run", fill: "Log run 5 km in 30 minutes" },
  { icon: "●", label: "Unread notifications", send: "unread notifications" },
  { icon: "♦", label: "Upcoming dates", send: "upcoming birthdays and dates" },
  { icon: "▤", label: "Flashcards due", send: "flashcards due" },
  { icon: "⌕", label: "Search my workspace", fill: "Search " },
  { icon: "∑", label: "Calculate", fill: "Calculate " },
];
