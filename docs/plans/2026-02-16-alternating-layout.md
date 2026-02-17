# Alternating Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement cascading alternating layout with configurable nesting mode and command control.

**Architecture:** `Layout.Alternating` computes split orientation by alternating depth (even=horizontal, odd=vertical) while split logic chooses the nesting target based on a new `alternatingMode` config. A new command updates `alternatingMode` at runtime, and IPC config updates persist the setting.

**Tech Stack:** TypeScript (ESM), Jasmine unit tests, Bun tooling.

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

### Task 3: Implement alternating depth strategy

**Files:**
- Modify: `src/layout/strategy.ts`
- Test: `tests/unit/layout/strategy.test.ts`

**Step 1: Write the failing test**

Add tests that validate alternating depth orientation. Use a parent with layout Alternating and a child container with layout Alternating to simulate depth 1.

```ts
it("alternating strategy flips orientation by depth", () => {
  const root = new SplitContainer("root", Layout.Alternating);
  const child = new SplitContainer("child", Layout.Alternating);
  const winA = new WindowContainer("a", {}, 1, "app", "A");
  const winB = new WindowContainer("b", {}, 2, "app", "B");
  root.rect = { x: 0, y: 0, width: 1000, height: 800 };
  child.rect = root.rect;
  root.addChild(child);
  child.addChild(winA);
  child.addChild(winB);

  getLayoutStrategy(Layout.Alternating).computeRects(child);

  expect(winA.rect.height).toBeLessThan(winB.rect.height + 1);
  expect(winA.rect.width).toBe(1000);
});
```

**Step 2: Run test to verify it fails**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="alternating strategy flips"`

Expected: FAIL (still horizontal).

**Step 3: Write minimal implementation**

Compute alternating depth by walking parents and counting those with `layout === Layout.Alternating`.

```ts
const alternatingDepth = (container: Container): number => {
  let depth = 0;
  let current = container.parent;
  while (current) {
    if (current.layout === Layout.Alternating) {
      depth += 1;
    }
    current = current.parent;
  }
  return depth;
};

// in alternatingStrategy.computeRects
const isHorizontal = alternatingDepth(container) % 2 === 0;
computeSplitRects(container, isHorizontal);
```

**Step 4: Run test to verify it passes**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="alternating strategy flips"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/layout/strategy.ts tests/unit/layout/strategy.test.ts
git commit -m "feat(layout): alternate split orientation by depth"
```

---

### Task 4: Split behavior for alternating mode

**Files:**
- Modify: `src/commands/handlers/core.ts`
- Test: `tests/unit/commands/handlers/core.test.ts`

**Step 1: Write the failing test**

Add two tests for split targeting.

```ts
it("split in alternating mode targets focused child", () => {
  const parent = new SplitContainer("parent", Layout.Alternating);
  const focused = new WindowContainer("focused", {}, 1, "app", "Focus");
  const tail = new WindowContainer("tail", {}, 2, "app", "Tail");
  parent.addChild(tail);
  parent.addChild(focused);
  parent.focusedChild = focused;

  const config = { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" };
  splitHandler.execute(makeCommand("splitv"), {
    root: parent as any,
    focused,
    adapter: makeAdapter(),
    config,
  });

  expect(parent.children[0]).toBe(tail);
  expect(parent.children[1]).toBeDefined();
});

it("split in alternating mode targets tail child", () => {
  const parent = new SplitContainer("parent", Layout.Alternating);
  const a = new WindowContainer("a", {}, 1, "app", "A");
  const b = new WindowContainer("b", {}, 2, "app", "B");
  parent.addChild(a);
  parent.addChild(b);

  const config = { minTileWidth: 300, minTileHeight: 240, alternatingMode: "tail" };
  splitHandler.execute(makeCommand("splitv"), {
    root: parent as any,
    focused: a,
    adapter: makeAdapter(),
    config,
  });

  expect(parent.children[parent.children.length - 1]).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="split in alternating mode"`

Expected: FAIL.

**Step 3: Write minimal implementation**

In `splitHandler`, when `parent.layout === Layout.Alternating`, select the target child based on `config.alternatingMode` before applying split behavior.

```ts
const selectAlternatingTarget = (parent: Container, focused: Container | null, mode: "focused" | "tail") => {
  if (mode === "tail") {
    return parent.children[parent.children.length - 1] ?? focused;
  }
  return parent.focusedChild ?? focused;
};
```

Use this target instead of `focused` when deciding where to split.

**Step 4: Run test to verify it passes**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="split in alternating mode"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/handlers/core.ts tests/unit/commands/handlers/core.test.ts
git commit -m "feat(split): honor alternating mode target"
```

---

### Task 5: Full test run and docs update

**Files:**
- Modify: `AGENTS.md` (optional, document new command if desired)

**Step 1: Run full test suite**

Run: `bun run test`

Expected: PASS.

**Step 2: Update AGENTS (optional)**

Add `alternating-mode focused|tail` to command examples or IPC usage if you want it documented for agents.

**Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): document alternating-mode command"
```
