export const KIND_LABELS: Record<string, string> = {
  book: "Book",
  movie: "Film",
  show: "Show",
  game: "Game",
  music: "Music",
  podcast: "Podcast",
  other: "Other",
};
export const STATUS_LABELS: Record<string, string> = {
  wishlist: "Wishlist",
  in_progress: "In progress",
  done: "Done",
  dropped: "Dropped",
};

type Row = { kind: string; status: string; rating: number | null; finished_on: string | null };

export function summarise(rows: Row[], year: string) {
  const byStatus: Record<string, number> = { wishlist: 0, in_progress: 0, done: 0, dropped: 0 };
  const doneThisYear: Record<string, number> = {};
  let ratingSum = 0;
  let rated = 0;
  for (const r of rows) {
    if (r.status in byStatus) byStatus[r.status]! += 1;
    if (r.status === "done" && r.finished_on?.startsWith(year))
      doneThisYear[r.kind] = (doneThisYear[r.kind] ?? 0) + 1;
    if (r.status === "done" && r.rating) {
      ratingSum += r.rating;
      rated += 1;
    }
  }
  return {
    byStatus,
    doneThisYear,
    averageRating: rated ? Math.round((ratingSum / rated) * 10) / 10 : null,
  };
}

/** Stars for display, e.g. 4 -> "★★★★☆". */
export const stars = (n: number | null) => (n ? "★".repeat(n) + "☆".repeat(5 - n) : "");
