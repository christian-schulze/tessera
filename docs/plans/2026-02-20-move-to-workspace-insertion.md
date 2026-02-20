# Move-to-Workspace Insertion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure move-to-workspace uses the alternating insertion strategy so a moved window gets the expected SplitH wrapper in the workspace tree.

**Architecture:** Reuse the existing `insertWindowWithStrategy` logic in the move handler instead of appending directly to the target split. Select a target-focused window in the destination workspace to drive alternating placement, then reflow/apply layout as usual.

**Tech Stack:** TypeScript, GNOME Shell (GJS), Jasmine

---

### Task 1: Add a failing unit test for move-to-workspace insertion

**Files:**
- Modify: `tests/unit/commands/move-to-workspace.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "jasmine";
import { CommandEngine } from "../../../src/commands/engine.js";
import { registerDefaultHandlers } from "../../../src/commands/index.js";
import { RootContainer } from "../../../src/tree/root-container.js";
import { WorkspaceContainer } from "../../../src/tree/workspace-container.js";
import { SplitContainer } from "../../../src/tree/split-container.js";
import { WindowContainer } from "../../../src/tree/window-container.js";
import { Layout } from "../../../src/tree/types.js";

const makeWindow = (id: number, title: string) => {
  const window = new WindowContainer(id, {} as never, id, "firefox", title);
  window.rect = { x: 0, y: 0, width: 100, height: 100 };
  return window;
};

describe("move container to workspace", () => {
  it("uses alternating insertion when moving into a workspace", () => {
    const root = new RootContainer(1);
    const workspace10 = new WorkspaceContainer(2, "10", 10, true);
    const split = new SplitContainer(3, Layout.Alternating);
    workspace10.addChild(split);
    root.addChild(workspace10);

    const focusedWindow = makeWindow(4, "Focused");
    split.addChild(focusedWindow);

    const movingWindow = makeWindow(5, "Moving");
    const workspace1 = new WorkspaceContainer(6, "1", 1, false);
    const sourceSplit = new SplitContainer(7, Layout.Alternating);
    workspace1.addChild(sourceSplit);
    sourceSplit.addChild(movingWindow);
    root.addChild(workspace1);

    const engine = new CommandEngine({
      root,
      adapter: {
        moveToWorkspace: () => undefined,
      } as never,
      config: {
        alternatingMode: "focused",
      } as never,
    });
    registerDefaultHandlers(engine);

    engine.execute("move container to workspace 10", movingWindow);

    const targetSplit = workspace10.children[0] as SplitContainer;
    expect(targetSplit.layout).toBe(Layout.Alternating);
    expect(targetSplit.children.length).toBe(1);
    const wrapper = targetSplit.children[0] as SplitContainer;
    expect(wrapper.layout).toBe(Layout.SplitH);
    expect(wrapper.children.map((child) => child.id)).toEqual([4, 5]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --spec=tests/unit/commands/move-to-workspace.test.ts`

Expected: FAIL because the moved window is appended directly and there is no SplitH wrapper.

### Task 2: Implement alternating insertion in move handler

**Files:**
- Modify: `src/commands/handlers/core.ts`

**Step 1: Write minimal implementation**

```ts
import { insertWindowWithStrategy } from "../../window-insertion.js";

// Inside move container to workspace
const split = findSplitTarget(targetWorkspace);
const fallbackFocused = findFirstWindow(targetWorkspace) ?? sourceWindow;
const lastFocusedId = targetWorkspace.lastFocusedWindowId;
const preferredFocused = lastFocusedId
  ? findWindowById(targetWorkspace, lastFocusedId)
  : null;
const focused = preferredFocused ?? fallbackFocused;

insertWindowWithStrategy({
  root: context.root,
  split,
  container: sourceWindow,
  focused,
  mode: context.config.alternatingMode ?? "focused",
});
```

**Step 2: Run test to verify it passes**

Run: `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --spec=tests/unit/commands/move-to-workspace.test.ts`

Expected: PASS with wrapper split present.

**Step 3: Run full test suite**

Run: `bun run test`

Expected: 0 failures (pending specs allowed).

### Task 3: Commit

**Step 1: Stage changes**

```bash
git add src/commands/handlers/core.ts tests/unit/commands/move-to-workspace.test.ts
```

**Step 2: Commit**

```bash
git commit -m "fix(commands): honor alternating insertion on workspace move"
```
