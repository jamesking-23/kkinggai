import { requireModule } from "../../../lib/modules";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";
import type { FlashParams } from "../../../lib/form";
import {
  Card,
  Empty,
  Flash,
  inputClass,
  PageHeader,
  primaryButton,
  subtleButton,
} from "../../../components/ui";
import { createCard, createDeck, deleteCard, deleteDeck, reviewCard } from "./actions";

const RATING_BUTTONS = [
  { value: 0, label: "Again" },
  { value: 1, label: "Hard" },
  { value: 2, label: "Good" },
  { value: 3, label: "Easy" },
];

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<FlashParams>;
}) {
  const ctx = await getAppContext();
  requireModule(ctx, "flashcards");
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const ws = ctx.current.id;
  const nowIso = new Date().toISOString();

  const [{ data: decks }, { data: cards }] = await Promise.all([
    supabase
      .from("flashcard_decks")
      .select("id, name, description, revision")
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("flashcards")
      .select("id, deck_id, front, back, due_at, revision")
      .eq("workspace_id", ws)
      .is("deleted_at", null)
      .order("due_at", { ascending: true })
      .limit(500),
  ]);
  const deckList = decks ?? [];
  const cardList = cards ?? [];
  const due = cardList.filter((c) => c.due_at <= nowIso);
  const next = due[0];
  const deckName = new Map(deckList.map((d) => [d.id, d.name]));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Flashcards"
        subtitle="Spaced repetition: cards you find hard come back sooner."
      />
      <Flash error={error} message={message} />

      <Card title={`Review${due.length ? ` · ${due.length} due` : ""}`} className="mb-6">
        {next ? (
          <div>
            <p className="text-xs text-muted">{deckName.get(next.deck_id) ?? "Deck"}</p>
            <p className="mt-1 whitespace-pre-wrap text-base">{next.front}</p>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-primary">Show answer</summary>
              <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-bg p-3 text-sm">
                {next.back}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {RATING_BUTTONS.map((r) => (
                  <form key={r.value} action={reviewCard}>
                    <input type="hidden" name="id" value={next.id} />
                    <input type="hidden" name="revision" value={next.revision} />
                    <input type="hidden" name="rating" value={r.value} />
                    <button type="submit" className={subtleButton}>
                      {r.label}
                    </button>
                  </form>
                ))}
              </div>
            </details>
          </div>
        ) : (
          <Empty>
            {cardList.length
              ? "Nothing due right now. Come back later."
              : "Add a deck and some cards to start."}
          </Empty>
        )}
      </Card>

      <p className="mb-6 text-sm">
        <a href="/flashcards/quiz" className="text-primary">
          Take a quiz on all cards
        </a>
      </p>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card title="New deck">
          <form action={createDeck} className="space-y-2">
            <input
              name="name"
              required
              maxLength={200}
              placeholder="Deck name"
              aria-label="Deck name"
              className={inputClass}
            />
            <input
              name="description"
              maxLength={1000}
              placeholder="Description (optional)"
              aria-label="Description"
              className={inputClass}
            />
            <button type="submit" className={subtleButton}>
              Create deck
            </button>
          </form>
        </Card>
        <Card title="New card">
          <form action={createCard} className="space-y-2">
            <select name="deckId" required defaultValue="" aria-label="Deck" className={inputClass}>
              <option value="" disabled>
                Choose a deck
              </option>
              {deckList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <textarea
              name="front"
              required
              rows={2}
              maxLength={2000}
              placeholder="Question"
              aria-label="Question"
              className={inputClass}
            />
            <textarea
              name="back"
              required
              rows={2}
              maxLength={4000}
              placeholder="Answer"
              aria-label="Answer"
              className={inputClass}
            />
            <button type="submit" className={primaryButton}>
              Add card
            </button>
          </form>
        </Card>
      </div>

      {deckList.length ? (
        <ul className="space-y-3">
          {deckList.map((d) => {
            const inDeck = cardList.filter((c) => c.deck_id === d.id);
            const dueInDeck = inDeck.filter((c) => c.due_at <= nowIso).length;
            return (
              <li key={d.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {inDeck.length} card{inDeck.length === 1 ? "" : "s"} · {dueInDeck} due
                      {d.description ? ` · ${d.description}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/flashcards/quiz?deck=${d.id}`} className={subtleButton}>
                      Quiz
                    </a>
                    <form action={deleteDeck}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="revision" value={d.revision} />
                      <button type="submit" className={subtleButton}>
                        Remove deck
                      </button>
                    </form>
                  </div>
                </div>
                {inDeck.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {inDeck.slice(0, 20).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">{c.front}</span>
                        <form action={deleteCard}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="revision" value={c.revision} />
                          <button type="submit" className={subtleButton}>
                            Remove
                          </button>
                        </form>
                      </li>
                    ))}
                    {inDeck.length > 20 && (
                      <li className="text-xs text-muted">and {inDeck.length - 20} more</li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No decks yet.</Empty>
      )}
    </div>
  );
}
