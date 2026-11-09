import { requireModule } from "../../../../lib/modules";
import { buildQuiz, gradeQuiz, MIN_QUIZ_CARDS } from "../../../../lib/quiz";
import { getAppContext } from "../../../../lib/session";
import { createClient } from "../../../../lib/supabase/server";
import { Card, Empty, PageHeader, primaryButton, subtleButton } from "../../../../components/ui";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function QuizPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await getAppContext();
  requireModule(ctx, "flashcards");
  const params = await searchParams;
  const deckId = one(params.deck) && UUID.test(one(params.deck)!) ? one(params.deck)! : null;
  const count = Math.min(20, Math.max(1, Number(one(params.n)) || 10));
  const supabase = await createClient();

  let query = supabase
    .from("flashcards")
    .select("id, front, back")
    .eq("workspace_id", ctx.current.id)
    .is("deleted_at", null)
    .limit(500);
  if (deckId) query = query.eq("deck_id", deckId);
  const { data } = await query;
  const cards = data ?? [];
  const byId = new Map(cards.map((c) => [c.id, c]));

  const asked = (one(params.q) ?? "").split(",").filter((id) => UUID.test(id) && byId.has(id));
  const answered = asked.length > 0 && asked.some((id) => one(params[`a_${id}`]));
  const base = `/flashcards/quiz${deckId ? `?deck=${deckId}&` : "?"}`;

  if (answered) {
    const answers = Object.fromEntries(asked.map((id) => [id, one(params[`a_${id}`])]));
    const result = gradeQuiz(asked, answers);
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-2 text-sm">
          <a href="/flashcards" className="text-primary">
            ← Flashcards
          </a>
        </p>
        <PageHeader
          title="Quiz results"
          subtitle={`${result.correct} of ${result.total} correct (${result.percent}%)`}
        />
        <ul className="mb-6 space-y-3">
          {asked.map((id) => {
            const card = byId.get(id)!;
            const chosen = answers[id] ? byId.get(answers[id]!) : undefined;
            const right = answers[id] === id;
            return (
              <li key={id} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm font-medium">{card.front}</p>
                <p className={`mt-2 text-sm ${right ? "text-success" : "text-danger"}`}>
                  {right ? "Correct" : chosen ? `Your answer: ${chosen.back}` : "No answer"}
                </p>
                {!right && <p className="mt-1 text-sm">Correct answer: {card.back}</p>}
              </li>
            );
          })}
        </ul>
        <a href={`${base}n=${count}`} className={primaryButton}>
          New quiz
        </a>
      </div>
    );
  }

  const quiz = buildQuiz(cards, count);
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm">
        <a href="/flashcards" className="text-primary">
          ← Flashcards
        </a>
      </p>
      <PageHeader title="Quiz" subtitle="Choose the answer that belongs to each question." />
      {quiz.length === 0 ? (
        <Empty>
          A quiz needs at least {MIN_QUIZ_CARDS} cards with different answers
          {deckId ? " in this deck" : ""}. Add more cards first.
        </Empty>
      ) : (
        <form action="/flashcards/quiz" method="get" className="space-y-4">
          {deckId && <input type="hidden" name="deck" value={deckId} />}
          <input type="hidden" name="n" value={count} />
          <input type="hidden" name="q" value={quiz.map((x) => x.cardId).join(",")} />
          {quiz.map((q, i) => (
            <Card key={q.cardId} title={`${i + 1}. ${q.prompt}`}>
              <fieldset className="space-y-2">
                <legend className="sr-only">Answers for question {i + 1}</legend>
                {q.options.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="radio" name={`a_${q.cardId}`} value={o.id} className="mt-1" />
                    <span className="whitespace-pre-wrap">{o.text}</span>
                  </label>
                ))}
              </fieldset>
            </Card>
          ))}
          <button type="submit" className={primaryButton}>
            Submit answers
          </button>
          <a href={`${base}n=${count}`} className={`${subtleButton} ml-2 inline-block`}>
            Shuffle
          </a>
        </form>
      )}
    </div>
  );
}
