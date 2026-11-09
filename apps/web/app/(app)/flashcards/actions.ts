"use server";

import { revalidatePath } from "next/cache";
import { cardReviewSchema, cardSchema, deckSchema } from "@kkingg/schemas";
import { firstIssue, flash } from "../../../lib/form";
import { isRating, schedule } from "../../../lib/spaced-repetition";
import { getAppContext } from "../../../lib/session";
import { createClient } from "../../../lib/supabase/server";

const PATH = "/flashcards";
const STALE = "This card was changed elsewhere. Reload and try again.";

export async function createDeck(formData: FormData) {
  const parsed = deckSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase.from("flashcard_decks").insert({
    workspace_id: ctx.current.id,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    course_id: parsed.data.courseId ?? null,
  });
  if (error) flash(PATH, "error", "Could not create the deck");
  revalidatePath(PATH);
  flash(PATH, "message", "Deck created");
}

export async function createCard(formData: FormData) {
  const parsed = cardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) flash(PATH, "error", firstIssue(parsed.error));
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { error } = await supabase.from("flashcards").insert({
    workspace_id: ctx.current.id,
    deck_id: parsed.data.deckId,
    front: parsed.data.front,
    back: parsed.data.back,
  });
  if (error) flash(PATH, "error", "Could not add the card");
  revalidatePath(PATH);
  flash(PATH, "message", "Card added");
}

export async function reviewCard(formData: FormData) {
  const parsed = cardReviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !isRating(parsed.data.rating)) flash(PATH, "error", "Invalid review");
  const { id, rating } = parsed.data;
  if (!isRating(rating)) flash(PATH, "error", "Invalid review");
  const revision = Number(formData.get("revision"));
  const ctx = await getAppContext();
  const supabase = await createClient();

  const { data: card } = await supabase
    .from("flashcards")
    .select("ease, interval_days, repetitions, lapses")
    .eq("id", id)
    .eq("workspace_id", ctx.current.id)
    .eq("revision", revision)
    .is("deleted_at", null)
    .maybeSingle();
  if (!card) flash(PATH, "error", STALE);

  const now = new Date();
  const next = schedule(
    {
      ease: Number(card.ease),
      intervalDays: card.interval_days,
      repetitions: card.repetitions,
      lapses: card.lapses,
    },
    rating,
    now,
  );
  const { data, error } = await supabase
    .from("flashcards")
    .update({
      ease: next.ease,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      due_at: next.dueAt.toISOString(),
      last_reviewed_at: now.toISOString(),
    })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not save the review");
  if (!data || data.length === 0) flash(PATH, "error", STALE);

  await supabase.from("card_reviews").insert({ workspace_id: ctx.current.id, card_id: id, rating });
  revalidatePath(PATH);
  flash(PATH, "message", "Review saved");
}

export async function deleteCard(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flashcards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the card");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Card removed");
}

export async function deleteDeck(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const revision = Number(formData.get("revision"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flashcard_decks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) flash(PATH, "error", "Could not remove the deck");
  if (!data || data.length === 0) flash(PATH, "error", STALE);
  revalidatePath(PATH);
  flash(PATH, "message", "Deck removed");
}
