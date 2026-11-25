import { evaluate, extractExpression, formatNumber, CalcError } from "./calc";
import {
  addDays,
  afterLeadIn,
  extractDate,
  extractDistanceM,
  extractDurationSeconds,
  extractQuery,
  localDate,
} from "./params";
import { MissingInput, type ActionContext, type Intent } from "./types";

const GREETINGS = [
  "Hello! Good to see you. What can I help you with?",
  "Hi there! How can I help today?",
  "Hey! I'm here. Ask me about your tasks, goals, runs or anything else I can look up.",
  'Hello, welcome back! Say "help" to see what I can do.',
  "Hi! Ready when you are.",
  "Greetings! What would you like to do?",
];

/** Replaceable in tests so greetings are predictable. */
export const greetingChoice = {
  pick: (list: readonly string[]): string => list[Math.floor(Math.random() * list.length)]!,
};

const list = (items: string[], max = 8) =>
  items
    .slice(0, max)
    .map((s) => `• ${s}`)
    .join("\n") + (items.length > max ? `\n…and ${items.length - max} more` : "");

const dateLabel = (iso: string | null, tz: string): string =>
  iso ? ` (due ${localDate(new Date(iso), tz)})` : "";

/**
 * Every feature, as a plain deterministic function. The embedding router only decides WHICH one to run; numbers,
 * dates and titles come from the message by regular expressions, and nothing here asks a language model for an answer.
 */
export const INTENTS: Record<string, Intent> = {
  greet_user: {
    summary: "Say hello",
    usage: "hello",
    examples: [
      "hello",
      "hi there",
      "good morning",
      "hey, how are you",
      "wassup",
      "wagwan",
      "oli otya",
      "agandi",
    ],
    async run() {
      return greetingChoice.pick(GREETINGS);
    },
  },

  help_menu: {
    summary: "List everything I can do",
    usage: "help",
    examples: [
      "help",
      "what can you do",
      "show me the commands",
      "how do i use this",
      "i dont know what to ask",
      "menu",
      "what are your features",
      "help me nkole kitya",
    ],
    async run(ctx) {
      const lines = Object.entries(ctx.intents)
        .filter(([id]) => id !== "help_menu")
        .map(([, i]) => (i.usage ? `• ${i.summary} — try: "${i.usage}"` : `• ${i.summary}`));
      return `Here is what I can do (it all works offline, on this server, with no AI service):\n${lines.join("\n")}\n\nI can't chat about other topics; ask me one of these.`;
    },
  },

  calculate: {
    summary: "Do arithmetic and percentages",
    usage: "calculate 15% of 200 + 3",
    examples: [
      "calculate 12 times 5",
      "can you calculate this for me",
      "what is 15% of 200",
      "evaluate 3 + 4 * 2",
      "compute the sum",
      "how much is 250 divided by 4",
      "work out 18 plus 27",
      "value of the expression gotten how",
    ],
    async run(_ctx, text) {
      const expr = extractExpression(text);
      if (!expr)
        throw new MissingInput('What should I calculate? For example: "calculate 15% of 200 + 3".');
      try {
        return `${expr.replace(/\s+/g, " ")} = ${formatNumber(evaluate(expr))}`;
      } catch (e) {
        if (e instanceof CalcError)
          throw new MissingInput(`I could not calculate that: ${e.message}`);
        throw e;
      }
    },
  },

  current_time: {
    summary: "Tell the date and time",
    usage: "what time is it",
    examples: [
      "what time is it",
      "what is the date today",
      "tell me the time",
      "today's date",
      "what day is it",
      "time now",
      "saa ngapi",
      "date today pls",
    ],
    async run(ctx) {
      const f = new Intl.DateTimeFormat("en-GB", {
        timeZone: safeZone(ctx.timeZone),
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `It is ${f.format(ctx.now)} (${safeZone(ctx.timeZone)}).`;
    },
  },

  list_open_tasks: {
    summary: "Show your open tasks",
    usage: "show my tasks",
    examples: [
      "show my tasks",
      "what are my open tasks",
      "list all my to do items",
      "tasks i have pending",
      "my tasks sebo",
      "what do i have to do",
      "give me my todo list",
      "tasks zange",
    ],
    async run(ctx) {
      const tasks = await ctx.data.openTasks(30);
      if (tasks.length === 0) return "You have no open tasks. Nice!";
      return `You have ${tasks.length}${tasks.length === 30 ? "+" : ""} open task${tasks.length === 1 ? "" : "s"}:\n${list(
        tasks.map((t) => `${t.title}${dateLabel(t.dueAt, ctx.timeZone)}`),
        10,
      )}`;
    },
  },

  tasks_due_today: {
    summary: "Show tasks due today or overdue",
    usage: "what is due today",
    examples: [
      "what is due today",
      "tasks due today",
      "anything overdue",
      "what should i do today",
      "deadlines today",
      "what is pending for today",
      "today tasks",
      "what is late",
    ],
    async run(ctx) {
      const today = localDate(ctx.now, ctx.timeZone);
      const due = (await ctx.data.openTasks(200)).filter(
        (t) => t.dueAt && localDate(new Date(t.dueAt), ctx.timeZone) <= today,
      );
      if (due.length === 0) return "Nothing is due today and nothing is overdue.";
      const overdue = due.filter((t) => localDate(new Date(t.dueAt!), ctx.timeZone) < today);
      return `Due today or overdue (${due.length}):\n${list(
        due.map((t) => `${t.title}${overdue.includes(t) ? " (overdue)" : ""}`),
        10,
      )}`;
    },
  },

  add_task: {
    summary: "Add a task",
    usage: "add task buy milk tomorrow",
    mutates: true,
    examples: [
      "add task buy milk",
      "create a task to call the bank tomorrow",
      "remind me to pay rent on friday",
      "new task submit report",
      "put on my list buy airtime",
      "i need to do laundry today",
      "add to my todo finish the essay",
      "task: email lecturer",
    ],
    async run(ctx, text) {
      const raw = afterLeadIn(text, [
        /\b(?:add|create|make|new)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:task|todo|to-do|to do)\b/i,
        /\bremind me\s+(?:to\s+)?/i,
        /\bput\s+(?:on|in)\s+(?:my\s+)?(?:list|todo|to-do)\b/i,
        /\bi need to\b/i,
        /\badd to my (?:todo|to-do|to do list|list)\b/i,
        /\btask\s*:/i,
      ]);
      if (!raw)
        throw new MissingInput('What is the task? For example: "add task buy milk tomorrow".');
      const { date, rest } = extractDate(raw, localDate(ctx.now, ctx.timeZone));
      const title = rest.replace(/^[\s:,-]+|[\s.!?]+$/g, "");
      if (title.length < 2)
        throw new MissingInput('What is the task? For example: "add task buy milk tomorrow".');
      if (title.length > 200)
        throw new MissingInput("That title is too long (200 characters at most).");
      await ctx.data.addTask({ title, dueDate: date });
      return `Added task: ${title}${date ? ` (due ${date})` : ""}.`;
    },
  },

  add_idea: {
    summary: "Save an idea",
    usage: "idea: sell airtime in the hostel",
    mutates: true,
    examples: [
      "idea: start a podcast",
      "save an idea about a tutoring app",
      "i have an idea",
      "note this idea sell fruit online",
      "new idea business card app",
      "idea: sell airtime in the hostel",
      "idea yange",
      "add idea mobile car wash",
    ],
    async run(ctx, text) {
      const title = afterLeadIn(text, [
        /\b(?:save|add|note|capture|new)\s+(?:an?\s+|this\s+)?idea\b(?:\s+(?:about|for))?/i,
        /\bi have an idea\b/i,
        /\bidea\s*:/i,
        /\bidea yange\b/i,
      ]);
      if (!title || title.length < 2)
        throw new MissingInput(
          'What is the idea? For example: "idea: sell airtime in the hostel".',
        );
      if (title.length > 200)
        throw new MissingInput("That idea title is too long (200 characters at most).");
      await ctx.data.addIdea(title);
      return `Saved idea: ${title}.`;
    },
  },

  habits_today: {
    summary: "Show today's habits",
    usage: "habits today",
    examples: [
      "habits today",
      "did i do my habits",
      "show my habits",
      "which habits are left",
      "habit streak status",
      "my daily habits",
      "habits zange leero",
      "what habits remain today",
    ],
    async run(ctx) {
      const habits = await ctx.data.habitsToday(localDate(ctx.now, ctx.timeZone));
      if (habits.length === 0) return "You have no habits yet. Add some in the Habits screen.";
      const done = habits.filter((h) => h.done).length;
      return `Habits today: ${done} of ${habits.length} done.\n${list(
        habits.map((h) => `${h.done ? "✓" : "○"} ${h.name}`),
        12,
      )}`;
    },
  },

  goals_progress: {
    summary: "Show goal progress",
    usage: "how are my goals",
    examples: [
      "how are my goals",
      "goal progress",
      "show my goals",
      "am i on track",
      "progress on what i am working toward",
      "my targets",
      "goals zange ziri otya",
      "update me on my goals",
    ],
    async run(ctx) {
      const goals = await ctx.data.goals();
      if (goals.length === 0) return "You have no goals yet.";
      return `Your goals:\n${list(
        goals.map((g) => {
          const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
          return `${g.title}: ${formatNumber(g.current)} of ${formatNumber(g.target)}${g.unit ? ` ${g.unit}` : ""} (${pct}%)${g.deadline ? `, by ${g.deadline}` : ""}`;
        }),
        8,
      )}`;
    },
  },

  running_report: {
    summary: "Training summary and coach report",
    usage: "how is my running",
    examples: [
      "how is my running",
      "running summary",
      "my training this week",
      "how many kilometres did i run",
      "coach report",
      "show my recent runs",
      "what is my weekly mileage",
      "next planned run",
    ],
    async run(ctx) {
      return ctx.data.runningReport();
    },
  },

  log_run: {
    summary: "Log a run",
    usage: "log run 5 km in 30 minutes",
    mutates: true,
    examples: [
      "log a run 5 km in 30 minutes",
      "i ran 10k in 55 minutes",
      "add run 3 miles 28:30",
      "record my run today",
      "just finished a run",
      "ran 5km in 32 mins",
      "i have run 8 km",
      "save my run",
    ],
    async run(ctx, text) {
      const distanceM = extractDistanceM(text);
      const seconds = extractDurationSeconds(text);
      if (distanceM === null || seconds === null)
        throw new MissingInput(
          `I need both a distance and a time${distanceM === null ? " (no distance found)" : ""}${seconds === null ? " (no time found)" : ""}. For example: "log run 5 km in 30 minutes".`,
        );
      if (seconds < 60)
        throw new MissingInput("That run is shorter than a minute. Check the time.");
      const date =
        extractDate(text, localDate(ctx.now, ctx.timeZone)).date ??
        localDate(ctx.now, ctx.timeZone);
      await ctx.data.logRun({ date, distanceM, seconds });
      const km = (distanceM / 1000).toFixed(2);
      const m = Math.floor(seconds / 60);
      return `Logged a run on ${date}: ${km} km in ${m} min ${seconds % 60} s.`;
    },
  },

  unread_notifications: {
    summary: "Count unread notifications",
    usage: "any notifications",
    examples: [
      "any notifications",
      "do i have unread notifications",
      "check my alerts",
      "what did i miss",
      "new messages for me",
      "notifications zange",
      "show alerts",
      "anything new",
    ],
    async run(ctx) {
      const n = await ctx.data.unreadNotifications();
      return n === 0
        ? "No unread notifications."
        : `You have ${n} unread notification${n === 1 ? "" : "s"}.`;
    },
  },

  upcoming_dates: {
    summary: "Show upcoming important dates",
    usage: "upcoming birthdays",
    examples: [
      "upcoming birthdays",
      "important dates coming up",
      "whose birthday is next",
      "any anniversaries soon",
      "what dates are coming",
      "remind me of important dates",
      "birthdays this month",
      "dates to remember",
    ],
    async run(ctx) {
      const dates = await ctx.data.importantDates();
      if (dates.length === 0) return "You have no important dates saved.";
      const today = localDate(ctx.now, ctx.timeZone);
      const year = Number(today.slice(0, 4));
      const withDays = dates
        .map((d) => {
          let next = `${year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
          if (next < today) next = `${year + 1}-${next.slice(5)}`;
          const days = Math.round(
            (Date.parse(`${next}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
          );
          return { title: d.title, next, days };
        })
        .sort((a, b) => a.days - b.days);
      return `Coming up:\n${list(
        withDays.map(
          (d) =>
            `${d.title}: ${d.days === 0 ? "today" : d.days === 1 ? "tomorrow" : `in ${d.days} days`} (${d.next})`,
        ),
        6,
      )}`;
    },
  },

  flashcards_due: {
    summary: "Count flashcards due",
    usage: "flashcards due",
    examples: [
      "flashcards due",
      "how many cards do i have to review",
      "study cards today",
      "do i have flashcards to revise",
      "cards to revise",
      "revision cards left",
      "flash cards pending",
      "what should i study",
    ],
    async run(ctx) {
      const n = await ctx.data.flashcardsDue();
      return n === 0
        ? "No flashcards are due. You're all caught up."
        : `${n} flashcard${n === 1 ? " is" : "s are"} due for review.`;
    },
  },

  search_workspace: {
    summary: "Search your workspace",
    usage: "search for invoice",
    examples: [
      "search for invoice",
      "find my notes about physics",
      "look up budget",
      "where is the thing about visas",
      "serch invoise",
      "find me anything on internship",
      "lookup cv",
      "search kyo",
    ],
    async run(ctx, text) {
      const q = extractQuery(text);
      if (!q)
        throw new MissingInput('What should I search for? For example: "search for invoice".');
      const hits = await ctx.data.search(q);
      if (hits.length === 0) return `Nothing found for “${q}”.`;
      return `Found ${hits.length}${hits.length >= 20 ? "+" : ""} result${hits.length === 1 ? "" : "s"} for “${q}”:\n${list(
        hits.map((h) => `${h.title} (${h.kind})`),
        8,
      )}`;
    },
  },
};

function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export { addDays };
export type { ActionContext };
