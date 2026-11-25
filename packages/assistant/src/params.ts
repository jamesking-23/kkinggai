// Parameter extraction with plain regular expressions. The router only picks an action; these pull out what it needs.

/** Today's date (yyyy-mm-dd) in a time zone. */
export function localDate(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** A due date written as today, tomorrow, a weekday name, or yyyy-mm-dd. Returns the date and the text with it removed. */
export function extractDate(text: string, today: string): { date: string | null; rest: string } {
  let rest = text;
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(rest);
  if (iso) {
    const d = new Date(`${iso[1]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso[1])
      return { date: iso[1]!, rest: rest.replace(iso[0], " ").replace(/\s+/g, " ").trim() };
  }
  const rel = /\b(?:by|on|for|due)?\s*(today|tomorrow|tonight)\b/i.exec(rest);
  if (rel) {
    const date = rel[1]!.toLowerCase() === "tomorrow" ? addDays(today, 1) : today;
    return { date, rest: rest.replace(rel[0], " ").replace(/\s+/g, " ").trim() };
  }
  const wd = new RegExp(`\\b(?:by|on|for|due|next)\\s+(${WEEKDAYS.join("|")})\\b`, "i").exec(rest);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[1]!.toLowerCase());
    const now = new Date(`${today}T00:00:00Z`).getUTCDay();
    const ahead = (target - now + 7) % 7 || 7;
    rest = rest.replace(wd[0], " ").replace(/\s+/g, " ").trim();
    return { date: addDays(today, ahead), rest };
  }
  return { date: null, rest: rest.trim() };
}

/** The text after the first matching lead-in such as "add task" or "remind me to". Null if nothing follows. */
export function afterLeadIn(text: string, leadIns: readonly RegExp[]): string | null {
  for (const re of leadIns) {
    const m = re.exec(text);
    if (m) {
      const rest = text
        .slice(m.index + m[0].length)
        .replace(/^[\s:,-]+|[\s.!?]+$/g, "")
        .replace(/^(?:called|named|titled|that|to|about)\s+/i, "")
        .replace(/^["'“”]+|["'“”]+$/g, "")
        .trim();
      return rest || null;
    }
  }
  return null;
}

/** A distance in metres from "5km", "5.2 k", "5000 m", "3 miles"; null if absent or out of range (10 m to 1000 km). */
export function extractDistanceM(text: string): number | null {
  const m =
    /(\d+(?:[.,]\d+)?)\s*(km|kms|kilometers?|kilometres?|k|miles?|mi|m|meters?|metres?)\b/i.exec(
      text,
    );
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  const unit = m[2]!.toLowerCase();
  const metres = /^(m|meters?|metres?)$/.test(unit)
    ? n
    : /^(miles?|mi)$/.test(unit)
      ? n * 1609.344
      : n * 1000;
  return metres >= 10 && metres <= 1_000_000 ? Math.round(metres) : null;
}

/** A duration in seconds from "30 minutes", "1h 5m", "45:30" or "1:05:30"; null if absent or zero. */
export function extractDurationSeconds(text: string): number | null {
  const clock = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/.exec(text);
  if (clock) {
    const h = clock[1] ? Number(clock[1]) : 0;
    const s = h * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    return s > 0 ? s : null;
  }
  let total = 0;
  const h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i.exec(text);
  const mi = /(\d+(?:\.\d+)?)\s*(?:min|mins|minutes?)\b/i.exec(text);
  const se = /(\d+)\s*(?:s|secs?|seconds?)\b/i.exec(text);
  if (h) total += Number(h[1]) * 3600;
  if (mi) total += Number(mi[1]) * 60;
  else if (h) {
    const bare = /\d\s*(?:h|hr|hrs|hours?)\s*(\d+)\s*m\b/i.exec(text);
    if (bare) total += Number(bare[1]) * 60;
  }
  if (se) total += Number(se[1]);
  return total > 0 ? Math.round(total) : null;
}

/** First thing in quotes, or the text after "for"/"about"/"called". Used for search terms and titles. */
export function extractQuery(text: string): string | null {
  const q = /["'“”]([^"'“”]{2,100})["'“”]/.exec(text);
  if (q) return q[1]!.trim();
  const m =
    /\b(?:search|find|look up|lookup|look for|search for|find me)\s+(?:for\s+)?(.{2,100})$/i.exec(
      text.trim(),
    );
  const v = m?.[1]?.replace(/[.!?]+$/, "").trim();
  return v && v.length >= 2 ? v : null;
}
