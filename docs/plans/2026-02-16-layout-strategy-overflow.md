# Layout Strategy Overflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move overflow/floating decisions out of WindowTracker and into per-layout strategies, enabling easy addition of new layouts (e.g., alternating split) without conflicting behavior.

**Architecture:** Introduce a layout strategy registry keyed by `Layout`. Each strategy provides `computeRects` (existing behavior) and overflow decisions (`shouldFloatOnAdd`, `shouldFloatOnRetry`). WindowTracker becomes an orchestrator: it queries the active layout strategy for overflow policy and applies the result. This keeps overflow fully per-layout and extensible.

**Tech Stack:** TypeScript, GJS/Meta (runtime), Jasmine tests.

---

## Design Notes

**New types (conceptual):**

```ts
export interface OverflowContext {
  layout: Layout;
  workspaceRect: Rect;
  tiledCount: number;
  projectedCount: number;
  actualRect?: Rect; // retry path
  config: {
    minTileWidth: number;
    minTileHeight: number;
  };
  container?: Container; // optional if needed later
}

export interface LayoutStrategy {
  id: Layout;
  computeRects: (container: Container) => void;
  shouldFloatOnAdd: (ctx: OverflowContext) => boolean;
  shouldFloatOnRetry: (ctx: OverflowContext) => boolean;
}
```

**Registry:** `getLayoutStrategy(layout)` returns a strategy. `SplitH` and `SplitV` strategies mirror existing overflow logic, but now per-layout. Future layouts (e.g., Alternating) can implement their own overflow decisions (e.g., width or height thresholds based on axis choice).

**WindowTracker change:** Replace inline overflow checks with strategy calls. WindowTracker still handles floating (setting flags, adding to floating list, reflow/applyLayout), but it no longer decides *when* to float.

---

### Task 1: Add layout strategy types and registry

**Files:**
- Create: `src/layout/strategy.ts`
- Modify: `src/tree/reflow.ts`
- Test: `tests/unit/layout/strategy.test.ts`

**Step 1: Write the failing test**

```ts
import { getLayoutStrategy } from "../../../src/layout/strategy.js";
import { Layout } from "../../../src/tree/types.js";

describe("layout strategies", () => {
  it("returns split strategies for SplitH and SplitV", () => {
    expect(getLayoutStrategy(Layout.SplitH).id).toBe(Layout.SplitH);
    expect(getLayoutStrategy(Layout.SplitV).id).toBe(Layout.SplitV);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/unit/layout/strategy.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

Create `src/layout/strategy.ts` with:
- `LayoutStrategy` and `OverflowContext` types
- `getLayoutStrategy(layout)` with SplitH/SplitV registered (strategies can be stubbed until Task 2)

**Step 4: Wire computeRects**

Update `src/tree/reflow.ts` to use `getLayoutStrategy(container.layout).computeRects(container)` instead of any inline layout logic (if present). If `reflow.ts` already delegates to helpers, adapt those helpers into the SplitH/SplitV strategies.

**Step 5: Run test to verify it passes**

Run: `bun run test -- tests/unit/layout/strategy.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/layout/strategy.ts src/tree/reflow.ts tests/unit/layout/strategy.test.ts
git commit -m "feat(layout): add strategy registry"
```

---

### Task 2: Move SplitH/SplitV overflow logic into strategies

**Files:**
- Modify: `src/layout/strategy.ts`
- Modify: `src/window-tracker.ts`
- Test: `tests/unit/window-tracker-overflow.test.ts`

**Step 1: Write the failing tests**

Add tests to `tests/unit/window-tracker-overflow.test.ts` (or create new) asserting:
- SplitH uses `minTileWidth` (existing behavior)
- SplitV uses `minTileHeight`
- WindowTracker calls strategy functions instead of inline checks

If `window-tracker-overflow` tests already exist, extend them to validate that the decision path uses the strategy results. Use a spyable strategy (or a fake registry) if needed.

**Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/unit/window-tracker-overflow.test.ts`
Expected: FAIL (strategy hooks not wired)

**Step 3: Implement strategy overflow**

In `src/layout/strategy.ts`:
- `SplitH.shouldFloatOnAdd` returns `workspaceRect.width / projectedCount < config.minTileWidth`.
- `SplitH.shouldFloatOnRetry` returns `workspaceRect.width / tiledCount < Math.max(config.minTileWidth, actualRect.width)` (guard for `tiledCount` and `actualRect`).
- `SplitV` mirrors `SplitH` but uses height and `minTileHeight`.

In `src/window-tracker.ts`:
- Replace inline overflow checks with:
  - `const strategy = getLayoutStrategy(split.layout)`
  - `strategy.shouldFloatOnAdd(ctx)`
  - `strategy.shouldFloatOnRetry(ctx)`

**Step 4: Run tests to verify they pass**

Run: `bun run test -- tests/unit/window-tracker-overflow.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/layout/strategy.ts src/window-tracker.ts tests/unit/window-tracker-overflow.test.ts
git commit -m "refactor(tracker): use layout overflow strategies"
```

---

### Task 3: Add scaffolding for Alternating layout

**Files:**
- Modify: `src/tree/types.ts`
- Modify: `src/layout/strategy.ts`
- Test: `tests/unit/layout/strategy.test.ts`

**Step 1: Write failing test**

```ts
import { getLayoutStrategy } from "../../../src/layout/strategy.js";
import { Layout } from "../../../src/tree/types.js";

describe("layout strategies", () => {
  it("has an Alternating strategy placeholder", () => {
    expect(getLayoutStrategy(Layout.Alternating).id).toBe(Layout.Alternating);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/unit/layout/strategy.test.ts`
Expected: FAIL

**Step 3: Implement minimal placeholder**

Add `Alternating` to `Layout` enum and create a strategy that:
- For now, delegates `computeRects` to `SplitH` (or a no-op),
- Sets `shouldFloatOnAdd/Retry` to use the axis you prefer as default (documented placeholder).

This keeps future layout work small while establishing the extension point.

**Step 4: Run test to verify it passes**

Run: `bun run test -- tests/unit/layout/strategy.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tree/types.ts src/layout/strategy.ts tests/unit/layout/strategy.test.ts
git commit -m "feat(layout): add alternating strategy placeholder"
```

---

### Task 4: Documentation

**Files:**
- Modify: `docs/plans/2026-02-15-phase-2-command-system.md`

**Step 1: Update docs**

Add a short section documenting that overflow behavior is now per-layout via strategy registry, and that Alternating is a placeholder for future work.

**Step 2: Commit**

```bash
git add docs/plans/2026-02-15-phase-2-command-system.md
git commit -m "docs: note layout strategy overflow"
```

---

### Task 5: Full verification (optional)

Run: `bun run check`
Expected: lint, build, tests pass

---

## Notes / Risks

- Ensure `reflow.ts` still produces identical layouts for SplitH/SplitV.
- Verify WindowTracker overflow behavior parity with prior logic.
- Alternating layout placeholder is not user-facing until real compute logic is added.
