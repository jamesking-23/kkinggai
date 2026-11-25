import { describe, expect, it, vi } from "vitest";
import { createAssistant, FALLBACK_REPLY, type Assistant } from "./assistant";
import { ngramEmbedder } from "./embedders";
import { greetingChoice, INTENTS } from "./intents";
import { createRouter } from "./router";
import type { AssistantData } from "./types";

function fakeData(over: Partial<AssistantData> = {}): AssistantData & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    openTasks: async () => [
      { title: "Buy milk", dueAt: "2026-11-24T20:59:00Z", priority: "medium" },
      { title: "Write report", dueAt: "2026-11-30T20:59:00Z", priority: "high" },
    ],
    addTask: async (i) => void calls.push(`addTask:${i.title}:${i.dueDate}`),
    addIdea: async (t) => void calls.push(`addIdea:${t}`),
    habitsToday: async () => [
      { name: "Read", done: true },
      { name: "Run", done: false },
    ],
    goals: async () => [{ title: "Save", current: 50, target: 200, unit: "USD", deadline: null }],
    runningReport: async () => "Weekly totals: 20 km",
    logRun: async (i) => void calls.push(`logRun:${i.date}:${i.distanceM}:${i.seconds}`),
    unreadNotifications: async () => 3,
    importantDates: async () => [{ title: "Mum", month: 12, day: 1, year: 1970 }],
    search: async () => [{ kind: "task", title: "Invoice 12" }],
    flashcardsDue: async () => 7,
    ...over,
  };
}

const NOW = new Date("2026-11-25T09:00:00Z");
let assistant: Assistant;
const ask = async (text: string, data = fakeData()) => ({
  r: await assistant.reply(text, { data, now: NOW, timeZone: "Africa/Kampala" }),
  data,
});

describe("offline assistant", async () => {
  assistant = await createAssistant({ embedder: ngramEmbedder() });

  it("has 5-8 examples for every intent", () => {
    for (const [id, i] of Object.entries(INTENTS)) {
      expect(i.examples.length, id).toBeGreaterThanOrEqual(5);
      expect(i.examples.length, id).toBeLessThanOrEqual(8);
    }
  });

  it("routes a labelled set of phrases (formal, casual, broken grammar, slang) to the right intent", async () => {
    const cases: [string, string][] = [
      ["hello", "greet_user"],
      ["wagwan", "greet_user"],
      ["oli otya", "greet_user"],
      ["good morning!", "greet_user"],
      ["help", "help_menu"],
      ["what can you do?", "help_menu"],
      ["can you calculate 12 * 5", "calculate"],
      ["what is 15% of 200", "calculate"],
      ["evaluate 3+4*2", "calculate"],
      ["what time is it", "current_time"],
      ["show my tasks", "list_open_tasks"],
      ["my tasks sebo", "list_open_tasks"],
      ["what is due today", "tasks_due_today"],
      ["add task buy milk tomorrow", "add_task"],
      ["remind me to pay rent on friday", "add_task"],
      ["idea: sell airtime in the hostel", "add_idea"],
      ["habits today", "habits_today"],
      ["how are my goals", "goals_progress"],
      ["how is my running", "running_report"],
      ["log run 5 km in 30 minutes", "log_run"],
      ["i ran 10k in 55 minutes", "log_run"],
      ["any notifications", "unread_notifications"],
      ["upcoming birthdays", "upcoming_dates"],
      ["flashcards due", "flashcards_due"],
      ["search for invoice", "search_workspace"],
      ["serch invoise", "search_workspace"],
      ["taks due tday", "tasks_due_today"],
    ];
    const wrong: string[] = [];
    for (const [text, want] of cases) {
      const { r } = await ask(text);
      if (r.intent !== want) wrong.push(`${text} -> ${r.intent} (want ${want})`);
    }
    expect(wrong).toEqual([]);
  });

  it("falls back politely on gibberish and unsupported chat, running nothing", async () => {
    for (const text of [
      "asdf qwer zxcv",
      "tell me a story about dragons",
      "who won the world cup",
      "xxxxxxxx",
      "   ",
      "!!!",
    ]) {
      const { r, data } = await ask(text);
      expect(r.unmatched, text).toBe(true);
      expect(r.text).toBe(FALLBACK_REPLY);
      expect(data.calls).toEqual([]);
    }
  });

  it("greets with a random warm greeting", async () => {
    const spy = vi.spyOn(greetingChoice, "pick").mockImplementation((l) => l[1]!);
    const { r } = await ask("hello");
    expect(r.intent).toBe("greet_user");
    expect(r.text).toBe("Hi there! How can I help today?");
    spy.mockRestore();
  });

  it("lists every supported command in the help menu", async () => {
    const { r } = await ask("help");
    for (const [id, i] of Object.entries(INTENTS))
      if (id !== "help_menu") expect(r.text).toContain(i.summary);
    expect(r.text).toContain("offline");
  });

  it("does the maths in code, not in a model", async () => {
    expect((await ask("what is 15% of 200 plus 3")).r.text).toContain("= 33");
    expect((await ask("calculate 10 divided by 0")).r.text).toMatch(/divide by zero/i);
    expect((await ask("calculate")).r.text).toMatch(/What should I calculate/);
  });

  it("adds a task with the date and title pulled out by regex, and asks when the title is missing", async () => {
    const a = await ask("add task buy milk tomorrow");
    expect(a.data.calls).toEqual(["addTask:buy milk:2026-11-26"]);
    expect(a.r.text).toContain("Added task: buy milk");
    const b = await ask("add task");
    expect(b.data.calls).toEqual([]);
    expect(b.r.text).toMatch(/What is the task/);
  });

  it("logs a run only with a distance and a time", async () => {
    const ok = await ask("log run 5 km in 30 minutes");
    expect(ok.data.calls).toEqual(["logRun:2026-11-25:5000:1800"]);
    const missing = await ask("log a run 5 km");
    expect(missing.data.calls).toEqual([]);
    expect(missing.r.text).toMatch(/no time found/);
  });

  it("reads data through the injected interface", async () => {
    expect((await ask("show my tasks")).r.text).toContain("Buy milk");
    expect((await ask("flashcards due")).r.text).toContain("7 flashcards");
    expect((await ask("any notifications")).r.text).toContain("3 unread");
    expect((await ask("how are my goals")).r.text).toContain("25%");
    expect((await ask("search for invoice")).r.text).toContain("Invoice 12");
    expect((await ask("how is my running")).r.text).toContain("20 km");
  });

  it("reports a data failure without claiming success", async () => {
    const data = fakeData({
      addTask: async () => {
        throw new Error("db down");
      },
    });
    const { r } = await ask("add task buy milk", data);
    expect(r.text).toMatch(/Nothing was changed/);
  });

  it("routes in well under 15 ms per message after startup", async () => {
    const router = await createRouter(INTENTS, ngramEmbedder());
    await router.route("warm up");
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) await router.route("show my tasks please");
    expect((performance.now() - t0) / 50).toBeLessThan(15);
  });

  it("honours a custom threshold", async () => {
    const strict = await createAssistant({ embedder: ngramEmbedder(), threshold: 0.999 });
    const r = await strict.reply("could you show my tasks now", { data: fakeData() });
    expect(r.unmatched).toBe(true);
  });
});
