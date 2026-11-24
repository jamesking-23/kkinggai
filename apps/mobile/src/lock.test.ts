import { describe, expect, it } from "vitest";
import { LOCK_GRACE_MS, lockState, shouldRelock } from "./lock";

describe("vault lock", () => {
  it("needs a screen lock on the phone", () => {
    expect(lockState(0)).toBe("no-lock");
    expect(lockState(1)).toBe("ready");
    expect(lockState(3)).toBe("ready");
  });

  it("relocks after the grace period in the background", () => {
    expect(shouldRelock(null, 1000)).toBe(false);
    expect(shouldRelock(1000, 1000 + LOCK_GRACE_MS - 1)).toBe(false);
    expect(shouldRelock(1000, 1000 + LOCK_GRACE_MS)).toBe(true);
    expect(shouldRelock(0, 5000, 1000)).toBe(true);
  });
});
