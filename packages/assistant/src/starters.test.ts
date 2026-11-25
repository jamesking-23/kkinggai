import { expect, it } from "vitest";
import { createRouter } from "./router";
import { INTENTS } from "./intents";
import { ngramEmbedder } from "./embedders";

// The phone's one-tap commands must reach the command they are labelled for.
const CASES: [string, string][] = [
  ["my tasks", "list_open_tasks"],
  ["tasks due today", "tasks_due_today"],
  ["calculate 15% of 80000", "calculate"],
  ["running report", "running_report"],
  ["help", "help_menu"],
  ["habits today", "habits_today"],
  ["goals progress", "goals_progress"],
  ["unread notifications", "unread_notifications"],
  ["upcoming birthdays and dates", "upcoming_dates"],
  ["flashcards due", "flashcards_due"],
];

it("one-tap phone commands route to the right intent", async () => {
  const r = await createRouter(INTENTS, ngramEmbedder());
  for (const [text, id] of CASES) {
    const hit = await r.route(text);
    expect(hit.matched && hit.id, text).toBe(id);
  }
});
