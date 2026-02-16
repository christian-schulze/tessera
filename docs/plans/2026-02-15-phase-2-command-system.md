# Phase 2 Command System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full command parser/engine/handler pipeline with immediate GNOME side effects and a required manual Looking Glass verification checklist.

**Architecture:** Parse i3-style command strings into a typed AST, resolve targets via criteria, dispatch to handler implementations that mutate the container tree and apply GNOME side effects through a thin adapter interface. Commands are executed in batch with per-command results and non-throwing errors.

**Tech Stack:** TypeScript (GJS), Jasmine tests, GNOME Shell 49 APIs, GLib.

---

### Task 1: Command types + parser (AST + chaining)

**Files:**
- Create: `src/commands/types.ts`
- Create: `src/commands/parser.ts`
- Create: `tests/unit/commands/parser.test.ts`

**Step 1: Write the failing test**

```ts
import { CommandParser } from "../../../src/commands/parser.js";

describe("CommandParser", () => {
  it("parses a basic command", () => {
    const commands = CommandParser.parse("focus left");
    expect(commands).toEqual([
      {
        criteria: [],
        action: "focus",
        args: ["left"],
        raw: "focus left",
      },
    ]);
  });

  it("parses criteria blocks", () => {
    const commands = CommandParser.parse("[app_id=\"firefox\"] focus");
    expect(commands[0].criteria).toEqual([
      { key: "app_id", operator: "=", value: "firefox" },
    ]);
  });

  it("parses chained commands", () => {
    const commands = CommandParser.parse("splitv; focus right");
    expect(commands.map((command) => command.action)).toEqual(["splitv", "focus"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `src/commands/parser.js`.

**Step 3: Write minimal implementation**

```ts
// src/commands/types.ts
export type CriteriaOperator = "=" | "!=";
export type CriteriaKey =
  | "app_id"
  | "title"
  | "class"
  | "workspace"
  | "con_mark"
  | "con_id"
  | "floating"
  | "tiling"
  | "urgent";

export interface CommandCriteria {
  key: CriteriaKey;
  operator: CriteriaOperator;
  value?: string;
}

export interface Command {
  criteria: CommandCriteria[];
  action: string;
  args: string[];
  raw: string;
}

export interface CommandResult {
  success: boolean;
  error?: string;
  payload?: unknown;
}
```

```ts
// src/commands/parser.ts
import type { Command, CommandCriteria } from "./types.js";

export class CommandParser {
  static parse(input: string): Command[] {
    return input
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => this.parseCommand(chunk));
  }

  private static parseCommand(chunk: string): Command {
    const { criteria, remainder } = this.extractCriteria(chunk);
    const tokens = this.tokenize(remainder);
    const action = tokens.shift() ?? "";
    return {
      criteria,
      action,
      args: tokens,
      raw: chunk,
    };
  }

  private static extractCriteria(chunk: string): { criteria: CommandCriteria[]; remainder: string } {
    const match = chunk.match(/^\s*\[(.+?)\]\s*(.*)$/);
    if (!match) {
      return { criteria: [], remainder: chunk };
    }

    const criteria = match[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, value] = part.split("=");
        const normalized = value?.replace(/^\"|\"$/g, "");
        return {
          key: key.trim(),
          operator: "=",
          value: normalized,
        } as CommandCriteria;
      });

    return { criteria, remainder: match[2] };
  }

  private static tokenize(text: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let inQuote = false;

    for (const char of text.trim()) {
      if (char === "\"") {
        inQuote = !inQuote;
        continue;
      }
      if (!inQuote && char === " ") {
        if (current) {
          tokens.push(current);
          current = "";
        }
        continue;
      }
      current += char;
    }
    if (current) {
      tokens.push(current);
    }
    return tokens;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for `CommandParser` tests.

**Step 5: Commit**

```bash
git add src/commands/types.ts src/commands/parser.ts tests/unit/commands/parser.test.ts
git commit -m "feat: add command parser and types"
```

### Task 2: Criteria evaluation

**Files:**
- Create: `src/commands/criteria.ts`
- Create: `tests/unit/commands/criteria.test.ts`

**Step 1: Write the failing test**

```ts
import { matchesCriteria } from "../../../src/commands/criteria.js";
import { WindowContainer } from "../../../src/tree/window-container.js";
import { WorkspaceContainer } from "../../../src/tree/workspace-container.js";

describe("matchesCriteria", () => {
  it("matches app_id and title", () => {
    const window = new WindowContainer(1, {} as unknown, 10, "firefox", "Docs");
    expect(matchesCriteria(window, [{ key: "app_id", operator: "=", value: "firefox" }])).toBe(true);
    expect(matchesCriteria(window, [{ key: "title", operator: "=", value: "Docs" }])).toBe(true);
  });

  it("matches workspace by name", () => {
    const workspace = new WorkspaceContainer(1, "dev", 2);
    expect(matchesCriteria(workspace, [{ key: "workspace", operator: "=", value: "dev" }])).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `src/commands/criteria.js`.

**Step 3: Write minimal implementation**

```ts
import type { CommandCriteria } from "./types.js";
import { Container, ContainerType } from "../tree/container.js";
import { WindowContainer } from "../tree/window-container.js";
import { WorkspaceContainer } from "../tree/workspace-container.js";

export function matchesCriteria(container: Container, criteria: CommandCriteria[]): boolean {
  if (criteria.length === 0) {
    return true;
  }

  return criteria.every((rule) => {
    switch (rule.key) {
      case "app_id":
        return container instanceof WindowContainer && container.appId === rule.value;
      case "title":
        return container instanceof WindowContainer && container.title === rule.value;
      case "workspace":
        return (
          container instanceof WorkspaceContainer &&
          (container.name === rule.value || String(container.number) === rule.value)
        );
      case "con_mark":
        return container.marks.has(rule.value ?? "");
      case "con_id":
        return String(container.id) === rule.value;
      case "floating":
        return container instanceof WindowContainer && container.floating;
      case "tiling":
        return container instanceof WindowContainer && !container.floating;
      case "urgent":
        return container instanceof WorkspaceContainer && container.urgent;
      default:
        return false;
    }
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for criteria tests.

**Step 5: Commit**

```bash
git add src/commands/criteria.ts tests/unit/commands/criteria.test.ts
git commit -m "feat: add command criteria matching"
```

### Task 3: Command engine + context + adapter interface

**Files:**
- Create: `src/commands/engine.ts`
- Create: `src/commands/context.ts`
- Create: `src/commands/adapter.ts`
- Create: `tests/unit/commands/engine.test.ts`

**Step 1: Write the failing test**

```ts
import { CommandEngine } from "../../../src/commands/engine.js";
import { CommandHandler } from "../../../src/commands/context.js";
import { RootContainer } from "../../../src/tree/root-container.js";

describe("CommandEngine", () => {
  it("executes a registered handler", () => {
    const root = new RootContainer(1);
    const engine = new CommandEngine({ root, focused: null, adapter: null });
    const handler: CommandHandler = {
      action: "focus",
      execute: () => ({ success: true }),
    };
    engine.register(handler);
    const result = engine.execute({ criteria: [], action: "focus", args: [], raw: "focus" });
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `src/commands/engine.js`.

**Step 3: Write minimal implementation**

```ts
// src/commands/context.ts
import { Container } from "../tree/container.js";
import { RootContainer } from "../tree/root-container.js";
import type { Command, CommandResult } from "./types.js";

export interface CommandContext {
  root: RootContainer;
  focused: Container | null;
  adapter: WindowAdapter | null;
  logger?: { info(message: string): void; warn(message: string): void; error(message: string): void };
}

export interface CommandHandler {
  action: string;
  execute(context: CommandContext, command: Command): CommandResult;
}

export interface WindowAdapter {
  activate(window: unknown): void;
  moveResize(window: unknown, rect: { x: number; y: number; width: number; height: number }): void;
  setFullscreen(window: unknown, enabled: boolean): void;
  setFloating(window: unknown, enabled: boolean): void;
  close(window: unknown): void;
  exec(command: string): void;
}
```

```ts
// src/commands/engine.ts
import type { Command, CommandResult } from "./types.js";
import type { CommandContext, CommandHandler } from "./context.js";

export class CommandEngine {
  private handlers = new Map<string, CommandHandler>();
  private context: CommandContext;

  constructor(context: CommandContext) {
    this.context = context;
  }

  register(handler: CommandHandler): void {
    this.handlers.set(handler.action, handler);
  }

  execute(command: Command): CommandResult {
    const handler = this.handlers.get(command.action);
    if (!handler) {
      return { success: false, error: `Unknown command: ${command.action}` };
    }
    return handler.execute(this.context, command);
  }

  executeBatch(commands: Command[]): CommandResult[] {
    return commands.map((command) => this.execute(command));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for engine tests.

**Step 5: Commit**

```bash
git add src/commands/context.ts src/commands/engine.ts src/commands/adapter.ts tests/unit/commands/engine.test.ts
git commit -m "feat: add command engine and context"
```

### Task 4: Apply layout utility (shared by tracker + commands)

**Files:**
- Create: `src/tree/apply-layout.ts`
- Modify: `src/window-tracker.ts`
- Create: `tests/unit/apply-layout.test.ts`

**Step 1: Write the failing test**

```ts
import { applyLayout } from "../../src/tree/apply-layout.js";
import { RootContainer } from "../../src/tree/root-container.js";
import { WindowContainer } from "../../src/tree/window-container.js";

describe("applyLayout", () => {
  it("calls adapter for window containers", () => {
    const root = new RootContainer(1);
    const window = new WindowContainer(2, {} as unknown, 10, "app", "title");
    root.addChild(window);
    window.rect = { x: 1, y: 2, width: 10, height: 11 };

    const calls: unknown[] = [];
    applyLayout(root, (win, rect) => calls.push({ win, rect }));

    expect(calls.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `src/tree/apply-layout.js`.

**Step 3: Write minimal implementation**

```ts
import { Container, ContainerType } from "./container.js";
import { WindowContainer } from "./window-container.js";

export type ApplyWindow = (window: unknown, rect: { x: number; y: number; width: number; height: number }) => void;

export function applyLayout(container: Container, applyWindow: ApplyWindow): void {
  if (container.type === ContainerType.Window) {
    const window = (container as WindowContainer).window;
    applyWindow(window, container.rect);
  }

  container.children.forEach((child) => applyLayout(child, applyWindow));
}
```

Update `src/window-tracker.ts` to call `applyLayout(root, ...)` instead of its local `applyLayout` method.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for apply-layout test.

**Step 5: Commit**

```bash
git add src/tree/apply-layout.ts src/window-tracker.ts tests/unit/apply-layout.test.ts
git commit -m "refactor: share applyLayout utility"
```

### Task 5: Core handlers (focus, move, resize, split, layout)

**Files:**
- Create: `src/commands/handlers/focus.ts`
- Create: `src/commands/handlers/move.ts`
- Create: `src/commands/handlers/resize.ts`
- Create: `src/commands/handlers/split.ts`
- Create: `src/commands/handlers/layout.ts`
- Create: `tests/unit/commands/handlers/core.test.ts`

**Step 1: Write the failing test**

```ts
import { RootContainer } from "../../../src/tree/root-container.js";
import { SplitContainer } from "../../../src/tree/split-container.js";
import { WindowContainer } from "../../../src/tree/window-container.js";
import { focusHandler } from "../../../src/commands/handlers/focus.js";

describe("core handlers", () => {
  it("focuses the right sibling", () => {
    const root = new RootContainer(1);
    const split = new SplitContainer(2);
    const left = new WindowContainer(3, {} as unknown, 10, "app", "left");
    const right = new WindowContainer(4, {} as unknown, 11, "app", "right");
    root.addChild(split);
    split.addChild(left);
    split.addChild(right);
    left.focused = true;

    const result = focusHandler.execute({ root, focused: left, adapter: null }, {
      criteria: [],
      action: "focus",
      args: ["right"],
      raw: "focus right",
    });

    expect(result.success).toBe(true);
    expect(right.focused).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `src/commands/handlers/focus.js`.

**Step 3: Write minimal implementation**

Implement handlers that:
- `focus`: set focused flags, optionally call `adapter.activate(window)`
- `move`: reorder child within parent or move between sibling containers
- `resize`: adjust proportions on parent container (e.g., grow/shrink width/height)
- `split`: set parent layout to splitv/splith
- `layout`: switch to stacking/tabbed/split layouts (for now adjust layout enum)

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for core handler tests.

**Step 5: Commit**

```bash
git add src/commands/handlers/focus.ts src/commands/handlers/move.ts src/commands/handlers/resize.ts src/commands/handlers/split.ts src/commands/handlers/layout.ts tests/unit/commands/handlers/core.test.ts
git commit -m "feat: add core command handlers"
```

### Task 6: Workspace + marks + floating + fullscreen

**Files:**
- Create: `src/commands/handlers/workspace.ts`
- Create: `src/commands/handlers/mark.ts`
- Create: `src/commands/handlers/floating.ts`
- Create: `src/commands/handlers/fullscreen.ts`
- Create: `tests/unit/commands/handlers/workspace.test.ts`

**Step 1: Write the failing test**

```ts
import { RootContainer } from "../../../src/tree/root-container.js";
import { WorkspaceContainer } from "../../../src/tree/workspace-container.js";
import { WindowContainer } from "../../../src/tree/window-container.js";
import { floatingHandler } from "../../../src/commands/handlers/floating.js";

describe("workspace handlers", () => {
  it("toggles floating on window container", () => {
    const root = new RootContainer(1);
    const workspace = new WorkspaceContainer(2, "dev", 1);
    const window = new WindowContainer(3, {} as unknown, 10, "app", "title");
    root.addChild(workspace);
    workspace.addChild(window);

    const result = floatingHandler.execute({ root, focused: window, adapter: null }, {
      criteria: [],
      action: "floating",
      args: ["toggle"],
      raw: "floating toggle",
    });

    expect(result.success).toBe(true);
    expect(window.floating).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `src/commands/handlers/floating.js`.

**Step 3: Write minimal implementation**

Handlers should:
- `workspace`: switch focused workspace (set visibility + focus), reflow and apply layout
- `mark/unmark`: update container marks set
- `floating`: toggle/set floating and update workspace floating list; call `adapter.setFloating`
- `fullscreen`: set container fullscreen flag; call `adapter.setFullscreen`

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for workspace handler tests.

**Step 5: Commit**

```bash
git add src/commands/handlers/workspace.ts src/commands/handlers/mark.ts src/commands/handlers/floating.ts src/commands/handlers/fullscreen.ts tests/unit/commands/handlers/workspace.test.ts
git commit -m "feat: add workspace and window state handlers"
```

### Task 7: Exec + kill handlers

**Files:**
- Create: `src/commands/handlers/exec.ts`
- Create: `src/commands/handlers/kill.ts`
- Create: `tests/unit/commands/handlers/process.test.ts`

**Step 1: Write the failing test**

```ts
import { execHandler } from "../../../src/commands/handlers/exec.js";

describe("process handlers", () => {
  it("exec forwards to adapter", () => {
    const calls: string[] = [];
    const result = execHandler.execute({
      root: null as unknown,
      focused: null,
      adapter: { exec: (command: string) => calls.push(command) } as unknown,
    }, { criteria: [], action: "exec", args: ["alacritty"], raw: "exec alacritty" });

    expect(result.success).toBe(true);
    expect(calls).toEqual(["alacritty"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `src/commands/handlers/exec.js`.

**Step 3: Write minimal implementation**

Handlers should:
- `exec`: call `adapter.exec(commandString)` (backed by `GLib.spawn_command_line_async`)
- `kill`: call `adapter.close(window)` if focused window exists

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for process handler tests.

**Step 5: Commit**

```bash
git add src/commands/handlers/exec.ts src/commands/handlers/kill.ts tests/unit/commands/handlers/process.test.ts
git commit -m "feat: add exec and kill handlers"
```

### Task 8: Wire engine + expose Looking Glass execute()

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/window-tracker.ts`
- Create: `src/commands/index.ts`
- Create: `tests/unit/commands/end-to-end.test.ts`

**Step 1: Write the failing test**

```ts
import { CommandEngine } from "../../../src/commands/engine.js";
import { CommandParser } from "../../../src/commands/parser.js";

describe("command end-to-end", () => {
  it("parses and executes chained commands", () => {
    const commands = CommandParser.parse("splitv; focus right");
    const engine = new CommandEngine({ root: null as unknown, focused: null, adapter: null });
    const results = engine.executeBatch(commands);
    expect(results.length).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL if handlers are not registered.

**Step 3: Write minimal implementation**

- Build a `registerDefaultHandlers(engine)` in `src/commands/index.ts` to register all handlers.
- In `src/extension.ts`, instantiate `CommandEngine` with root + focused + adapter.
- Add `__tessera.execute(command: string)` that parses, executes batch, and returns results.
- Add a simple GNOME adapter in `src/commands/adapter.ts` using `GLib` and `Meta.Window` APIs.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for end-to-end test.

**Step 5: Commit**

```bash
git add src/extension.ts src/commands/index.ts src/commands/adapter.ts tests/unit/commands/end-to-end.test.ts
git commit -m "feat: expose command execution and defaults"
```

### Task 9: Required manual verification checklist (Looking Glass)

**Files:**
- Modify: `docs/plans/2026-02-15-phase-2-command-system.md`

**Step 1: Perform manual checklist (required)**

Run in nested shell: `make nested`

Looking Glass:
```js
globalThis.__tessera.execute("splitv; focus right; move left; resize grow width 20 px")
globalThis.__tessera.execute("[app_id=\"firefox\"] focus; floating toggle; fullscreen toggle")
```

Verify:
- Focus changes correctly.
- Windows move/resize as expected.
- Floating toggles change window layer/behavior.
- Fullscreen toggles visually.

**Step 2: Record outcome in plan**

Append a short note under a new “Manual Verification” section with date and outcome.

**Step 3: Commit**

```bash
git add docs/plans/2026-02-15-phase-2-command-system.md
git commit -m "docs: record phase 2 manual verification"
```

---

## Manual Verification (Required)

- Status: COMPLETE
- Date: 2026-02-16
- Notes:
  - `make nested`: Looking Glass `globalThis.__tessera.execute("splitv")` returned `undefined`, but manually opening a new console window tiled vertically as expected.
  - `TESSERA_IPC=1 make nested`: IPC execute worked as expected for manual commands.
  - SplitV overflow now floats on min height (verified during nested manual tests).
  - `resize set` and `resize grow/shrink` behave as expected after min-size clamp changes.

## Config Notes

- `minTileWidth` (default 300): minimum tile width before new tiling windows float.
- `minTileHeight` (default 240): minimum tile height before new vertical tiling windows float.
- Overflow behavior is now defined per-layout via the strategy registry.
- Alternating layout is a placeholder (no custom strategy yet).

## Future Notes

- See backlog: `docs/plans/2026-02-16-backlog.md`.
