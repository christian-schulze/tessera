import {
  maybeRebuildTree,
  shouldContinuePolling,
  shouldRebuildTree,
} from "../../src/extension-rebuild.ts";

describe("extension rebuild helpers", () => {
  it("rebuilds when monitors exist but outputs are empty", () => {
    expect(shouldRebuildTree(0, 1)).toBe(true);
  });

  it("does not rebuild when outputs exist", () => {
    expect(shouldRebuildTree(1, 1)).toBe(false);
  });

  it("does not rebuild when monitors are missing", () => {
    expect(shouldRebuildTree(0, 0)).toBe(false);
  });

  it("invokes rebuild when conditions are met", () => {
    let called = 0;
    const result = maybeRebuildTree(0, 1, () => {
      called += 1;
    });

    expect(result).toBe(true);
    expect(called).toBe(1);
  });

  it("skips rebuild when outputs already exist", () => {
    let called = 0;
    const result = maybeRebuildTree(1, 1, () => {
      called += 1;
    });

    expect(result).toBe(false);
    expect(called).toBe(0);
  });

  it("continues polling when outputs are empty", () => {
    expect(shouldContinuePolling(0, 20, 0)).toBe(true);
  });

  it("stops polling when outputs exist", () => {
    expect(shouldContinuePolling(2, 20, 1)).toBe(false);
  });

  it("stops polling when attempts are exhausted", () => {
    expect(shouldContinuePolling(20, 20, 0)).toBe(false);
  });
});
