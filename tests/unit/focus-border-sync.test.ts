import { scheduleFocusBorderSync } from "../../src/focus-border-sync.ts";

describe("scheduleFocusBorderSync", () => {
  it("runs an immediate sync and schedules a delayed sync", () => {
    const updates: string[] = [];
    let scheduledDelay: number | null = null;
    let scheduledCallback: (() => void) | null = null;

    scheduleFocusBorderSync(
      () => {
        updates.push("sync");
      },
      (delayMs, callback) => {
        scheduledDelay = delayMs;
        scheduledCallback = callback;
      }
    );

    expect(updates).toEqual(["sync"]);
    expect(scheduledDelay).toBe(100);
    expect(scheduledCallback).not.toBeNull();

    scheduledCallback?.();
    expect(updates).toEqual(["sync", "sync"]);
  });
});
