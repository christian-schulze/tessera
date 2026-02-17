# Alternating Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement cascading alternating layout with configurable nesting mode and command control.

**Architecture:** `Layout.Alternating` uses an explicit base orientation (horizontal) for its own rect computation. Alternation is implemented by nesting `SplitContainer` children with explicit `Layout.SplitH` or `Layout.SplitV` based on split target rules. The split command chooses a target window (focused or tail) and then wraps that target in a new split container with the opposite axis. A new command updates `alternatingMode` at runtime, and IPC config updates persist the setting.

**Tech Stack:** TypeScript (ESM), Jasmine unit tests, Bun tooling.

---

**Note on size issues:** When adding windows directly under `Layout.SplitH` or
`Layout.SplitV`, the 3rd window still fits and the 4th overflows/floats as
expected. This suggests the minimum size constraints are not the root cause of
the size issues seen when adding the 3rd window to an alternating layout.

### Behavior scenarios (box drawing)

Notation:
- Focused tile marked with `*`
- Last child marked with `+`
- Labels centered in each tile
- Splits shown with box-drawing characters

#### Focus mode

1. Start (one window):

```
┌─────────────┐
│     A*      │
└─────────────┘
```

2. New window (Alternating base axis = SplitH):

```
┌─────────┬─────────┐
│    A*   │    B    │
└─────────┴─────────┘
```

3. Split in focus mode (focused is in SplitH, so use SplitV):

```
┌─────────┬─────────┐
│    A*   │    B    │
├─────────┤         │
│    C    │         │
└─────────┴─────────┘
```

4. Split again in focus mode (focused in SplitV, so use SplitH):

```
┌─────┬─────┬─────────┐
│  A* │  D  │    B    │
├─────┴─────┤         │
│     C     │         │
└───────────┴─────────┘
```

#### Tail mode

1. Start (one window):

```
┌─────────────┐
│     A+      │
└─────────────┘
```

2. New window (Alternating base axis = SplitH):

```
┌─────────┬─────────┐
│    A    │    B+   │
└─────────┴─────────┘
```

3. Split in tail mode (tail is B, last split axis is SplitH, so use SplitV):

```
┌─────────┬─────────┐
│    A    │    B    │
│         ├─────────┤
│         │    C+   │
└─────────┴─────────┘
```

4. Split in tail mode again (last split axis is SplitV, so use SplitH):

```
┌─────────┬───────────┐
│    A    │     B     │
│         ├─────┬─────┤
│         │  C  │  D+ │
└─────────┴─────┴─────┘
```

---


### Task 1: Add alternating mode to config and command

**Files:**
- Modify: `src/config.ts`
- Modify: `src/commands/handlers/core.ts`
- Test: `tests/unit/commands/handlers/core.test.ts`

**Step 1: Write the failing test**

Add a test that updates config via the new command and asserts `config.alternatingMode` is set.

```ts
it("alternating-mode updates config", () => {
  const adapter = makeAdapter();
  const config = { minTileWidth: 300, minTileHeight: 240 } as any;

  const result = alternatingModeHandler.execute(
    makeCommand("alternating-mode", ["tail"]),
    { root: null as any, focused: null as any, adapter, config }
  );

  expect(result.success).toBeTrue();
  expect(config.alternatingMode).toBe("tail");
});
```

**Step 2: Run test to verify it fails**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="alternating-mode updates config"`

Expected: FAIL (handler missing, config missing).

**Step 3: Write minimal implementation**

Add `alternatingMode` to the config type/defaults and accept it in `applyConfig`.

```ts
export type AlternatingMode = "focused" | "tail";

export type TesseraConfig = {
  minTileWidth: number;
  minTileHeight: number;
  alternatingMode: AlternatingMode;
};

export const DEFAULT_CONFIG: TesseraConfig = {
  minTileWidth: 300,
  minTileHeight: 240,
  alternatingMode: "focused",
};

const normalizeAlternatingMode = (value: unknown): AlternatingMode | null => {
  if (value === "focused" || value === "tail") {
    return value;
  }
  return null;
};

// in applyConfig
const alternatingMode = normalizeAlternatingMode(candidate.alternatingMode);
if (alternatingMode !== null) {
  target.alternatingMode = alternatingMode;
}

// in src/commands/handlers/core.ts
export const alternatingModeHandler: CommandHandler = {
  action: "alternating-mode",
  execute: (command, context) => {
    const mode = command.args[0];
    context.config.alternatingMode = mode as "focused" | "tail";
    return { success: true };
  },
};
```

**Step 4: Run test to verify it passes**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="alternating-mode updates config"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/config.ts src/commands/handlers/core.ts tests/unit/commands/handlers/core.test.ts
git commit -m "feat(config): add alternating mode setting"
```

---

### Task 2: Validate alternating-mode command values

**Files:**
- Modify: `src/commands/handlers/core.ts`
- Test: `tests/unit/commands/handlers/core.test.ts`

**Step 1: Write the failing test**

Add a test for invalid args.

```ts
it("alternating-mode rejects unknown values", () => {
  const adapter = makeAdapter();
  const config = { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" };

  const result = alternatingModeHandler.execute(
    makeCommand("alternating-mode", ["sideways"]),
    { root: null as any, focused: null as any, adapter, config }
  );

  expect(result.success).toBeFalse();
  expect(result.message).toContain("Unknown alternating mode");
});
```

**Step 2: Run test to verify it fails**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="alternating-mode rejects"`

Expected: FAIL (handler returns success today).

**Step 3: Write minimal implementation**

Add validation to the existing handler in `core.ts`.

```ts
export const alternatingModeHandler: CommandHandler = {
  action: "alternating-mode",
  execute: (command, context) => {
    const mode = command.args[0];
    if (mode !== "focused" && mode !== "tail") {
      return { success: false, message: "Unknown alternating mode" };
    }

    context.config.alternatingMode = mode;
    return { success: true };
  },
};
```

Register in the handler map where other core handlers are wired.

**Step 4: Run test to verify it passes**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="alternating-mode"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/handlers/core.ts tests/unit/commands/handlers/core.test.ts
git commit -m "feat(commands): add alternating-mode command"
```

---

### Task 3: Ensure Alternating layout uses horizontal base

**Files:**
- Modify: `src/layout/strategy.ts`
- Test: `tests/unit/layout/strategy.test.ts`

**Step 1: Write the failing test**

Add tests that validate Alternating layout uses horizontal base orientation for its own rects.

```ts
it("alternating strategy uses horizontal base", () => {
  const root = new SplitContainer("root", Layout.Alternating);
  const winA = new WindowContainer("a", {}, 1, "app", "A");
  const winB = new WindowContainer("b", {}, 2, "app", "B");
  root.rect = { x: 0, y: 0, width: 1000, height: 800 };
  root.addChild(winA);
  root.addChild(winB);

  getLayoutStrategy(Layout.Alternating).computeRects(root);

  expect(winA.rect.height).toBe(800);
  expect(winB.rect.height).toBe(800);
  expect(winA.rect.width).toBeLessThan(winB.rect.width + 1);
});
```

**Step 2: Run test to verify it fails**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="alternating strategy uses horizontal base"`

Expected: FAIL (Alternating not yet mapped to horizontal split).

**Step 3: Write minimal implementation**

Treat `Layout.Alternating` like `Layout.SplitH` for rect computation.

```ts
// in alternatingStrategy.computeRects
computeSplitRects(container, true);
```

**Step 4: Run test to verify it passes**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="alternating strategy uses horizontal base"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/layout/strategy.ts tests/unit/layout/strategy.test.ts
git commit -m "feat(layout): set alternating base orientation"
```

---

### Task 4: Split behavior for alternating mode (nested splits)

**Files:**
- Modify: `src/commands/handlers/core.ts`
- Test: `tests/unit/commands/handlers/core.test.ts`

**Step 1: Write the failing test**

Add tests for split targeting and nested split axis selection that match the behavior scenarios above.

```ts
it("split in alternating focus mode wraps focused with opposite axis", () => {
  const parent = new SplitContainer("parent", Layout.Alternating);
  const focused = new WindowContainer("focused", {}, 1, "app", "Focus");
  const sibling = new WindowContainer("sibling", {}, 2, "app", "Sibling");
  const split = new SplitContainer("split", Layout.SplitH);
  split.addChild(focused);
  split.addChild(sibling);
  focused.focused = true;
  parent.addChild(split);

  const config = { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" };
  splitHandler.execute(makeCommand("splitv"), {
    root: parent as any,
    focused,
    adapter: makeAdapter(),
    config,
  });

  const wrapped = focused.parent as SplitContainer;
  expect(wrapped.layout).toBe(Layout.SplitV);
  expect(wrapped.children).toContain(focused);
});

it("split in alternating tail mode walks to last child and flips axis", () => {
  const parent = new SplitContainer("parent", Layout.Alternating);
  const a = new WindowContainer("a", {}, 1, "app", "A");
  const b = new WindowContainer("b", {}, 2, "app", "B");
  const split = new SplitContainer("split", Layout.SplitH);
  split.addChild(a);
  split.addChild(b);
  parent.addChild(split);

  const config = { minTileWidth: 300, minTileHeight: 240, alternatingMode: "tail" };
  splitHandler.execute(makeCommand("splitv"), {
    root: parent as any,
    focused: a,
    adapter: makeAdapter(),
    config,
  });

  const tail = split.children[split.children.length - 1] as WindowContainer;
  const wrapped = tail.parent as SplitContainer;
  expect(wrapped.layout).toBe(Layout.SplitV);
});
```

**Step 2: Run test to verify it fails**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="split in alternating mode"`

Expected: FAIL.

**Step 3: Write minimal implementation**

In `splitHandler`, when `parent.layout === Layout.Alternating`, select the target child based on `config.alternatingMode` and wrap it in a new split container whose axis is the opposite of the relevant split axis (focused parent split in focus mode, or last split axis in tail mode).

```ts
const selectAlternatingTarget = (parent: Container, focused: Container | null, mode: "focused" | "tail") => {
  if (mode === "focused") {
    return parent.focusedChild() ?? focused;
  }

  return parent.children[parent.children.length - 1] ?? focused;
};

const getOppositeAxis = (layout: Layout): Layout.SplitH | Layout.SplitV => {
  return layout === Layout.SplitH ? Layout.SplitV : Layout.SplitH;
};

const findTailSplitAxis = (parent: Container): Layout.SplitH | Layout.SplitV => {
  let current = parent;
  let axis: Layout.SplitH | Layout.SplitV = Layout.SplitH;
  while (current.children.length > 0) {
    const lastChild = current.children[current.children.length - 1];
    if (current.type === ContainerType.Split) {
      axis = current.layout === Layout.SplitV ? Layout.SplitV : Layout.SplitH;
    }
    current = lastChild;
  }
  return axis;
};
```

Focused mode axis rule:
- Look at the target's parent split layout (`Layout.SplitH` or `Layout.SplitV`).
- Create a new split with the opposite axis and wrap the focused target.

Tail mode axis rule:
- Walk from the alternating parent down the last-child chain, tracking the last split axis.
- Create a new split with the opposite axis and wrap the tail target.

Then wrap the target with a new `SplitContainer` (opposite axis) and insert the new window as the sibling within that new split.

**Step 4: Run test to verify it passes**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="split in alternating mode"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/handlers/core.ts tests/unit/commands/handlers/core.test.ts
git commit -m "feat(split): honor alternating mode target"
```

---
