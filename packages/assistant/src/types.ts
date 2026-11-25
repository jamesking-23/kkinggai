/** An embedder turns phrases into vectors. It must run fully offline. */
export interface Embedder {
  readonly name: string;
  /** Similarity needed to accept a match when the caller does not set one. */
  readonly defaultThreshold: number;
  embed(texts: string[]): Promise<Float32Array[]>;
}

/** Thrown by an action when something it needs is missing; the message is shown to the user as a question. */
export class MissingInput extends Error {}

/** Everything an action may read or change. Implemented by the app against the user's own database session. */
export interface AssistantData {
  openTasks(limit: number): Promise<{ title: string; dueAt: string | null; priority: string }[]>;
  addTask(input: { title: string; dueDate: string | null }): Promise<void>;
  addIdea(title: string): Promise<void>;
  habitsToday(today: string): Promise<{ name: string; done: boolean }[]>;
  goals(): Promise<
    {
      title: string;
      current: number;
      target: number;
      unit: string | null;
      deadline: string | null;
    }[]
  >;
  /** A plain-text training report (weekly totals, recent runs, plan) built from the user's own data. */
  runningReport(): Promise<string>;
  logRun(input: { date: string; distanceM: number; seconds: number }): Promise<void>;
  unreadNotifications(): Promise<number>;
  importantDates(): Promise<{ title: string; month: number; day: number; year: number | null }[]>;
  search(query: string): Promise<{ kind: string; title: string }[]>;
  flashcardsDue(): Promise<number>;
}

export type ActionContext = {
  data: AssistantData;
  now: Date;
  timeZone: string;
  /** For the help menu: every intent the assistant supports. */
  intents: Readonly<Record<string, Intent>>;
};

export type Intent = {
  /** One line shown in the help menu. */
  summary: string;
  /** What to say to trigger it, e.g. `add task buy milk`. Shown in the help menu. */
  usage?: string;
  /** 5-8 phrases: formal, casual, broken grammar and local slang. Embedded once at startup. */
  examples: readonly string[];
  /** True when the action changes data. Such actions never run without the parameters they need. */
  mutates?: boolean;
  /** Deterministic action. Gets the user's original message, returns the reply. Throws MissingInput to ask a question. */
  run(ctx: ActionContext, text: string): Promise<string>;
};
