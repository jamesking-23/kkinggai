// Vault lock helpers. Pure. The lock uses the phone's own screen lock (fingerprint, face, PIN or pattern).

export type LockState = "ready" | "no-lock";

/** `level` is expo-local-authentication's SecurityLevel: 0 means the phone has no screen lock at all. */
export function lockState(level: number): LockState {
  return level > 0 ? "ready" : "no-lock";
}

/** The vault locks again when the app was in the background for longer than the grace period. */
export function shouldRelock(
  backgroundedAt: number | null,
  now: number,
  graceMs: number = LOCK_GRACE_MS,
): boolean {
  if (backgroundedAt === null) return false;
  return now - backgroundedAt >= graceMs;
}

export const LOCK_GRACE_MS = 30_000;
