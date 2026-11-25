// Labelled phrases used to check the router, including against the real embedding model (see the "Model check" workflow).

/** Phrase and the command it must reach: formal, casual, broken grammar and Ugandan slang. */
export const ROUTING_CASES: readonly (readonly [string, string])[] = [
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

/** Messages that must NOT run any command (they belong to Tier 2/3 or the polite fallback). */
export const NEGATIVE_PHRASES: readonly string[] = [
  "asdf qwer zxcv",
  "tell me a story about dragons",
  "who won the world cup",
  "xxxxxxxx",
  "what is the capital of uganda",
  "explain how photosynthesis works",
  "why is the sky blue",
  "how do I cook matooke",
];

/** Pairs for Tier 2: [a, b, shouldBeServedFromTheSameCachedAnswer]. */
export const CACHE_PAIRS: readonly (readonly [string, string, boolean])[] = [
  ["what is the capital of uganda", "uganda's capital city is what", true],
  ["how does photosynthesis work", "explain photosynthesis", true],
  ["what is the capital of uganda", "what is the capital of kenya", false],
  ["how does photosynthesis work", "how does respiration work", false],
  ["why is the sky blue", "why is the ocean blue", false],
];
