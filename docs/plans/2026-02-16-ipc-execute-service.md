# IPC Execute Shared Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide a single command execution service used by both IPC `execute` and `globalThis.__tessera.execute` so results stay in sync.

**Architecture:** Introduce a `buildCommandService` in `src/commands/service.ts` that owns the command engine, parsing, and execution flow. `extension.ts` will instantiate this service once and delegate both IPC and `__tessera` entry points to it. Existing IPC method shapes remain unchanged; only `execute` is routed through the shared service.

**Tech Stack:** TypeScript (ESM), GJS/Meta for window operations, Jasmine for tests.

---

### Task 1: Add shared command execution service

**Files:**
- Create: `src/commands/service.ts`
- Test: `tests/unit/commands/service.test.ts`

**Step 1: Write the failing test**

```ts
import type { CommandEngine } from "../../../src/commands/engine.js";
import type { WindowAdapter } from "../../../src/commands/adapter.js";
import { buildCommandService } from "../../../src/commands/service.js";

describe("command service", () => {
  it("returns an error when root is not ready", () => {
    const engine = {
      executeBatch: () => [{ success: true }],
    } as unknown as CommandEngine;

    const adapter = {
      activate: () => {},
      moveResize: () => {},
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
    } as WindowAdapter;

    const service = buildCommandService({
      engine,
      adapter,
      getRoot: () => null,
      getFocused: () => null,
    });

    expect(service.execute("focus left")).toEqual([
      { success: false, message: "Root container is not ready" },
    ]);
  });

  it("passes root, focused, and adapter to the engine", () => {
    const root = {};
    const adapter = {
      activate: () => {},
      moveResize: () => {},
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
    } as WindowAdapter;

    let captured: { root: unknown; focused: unknown; adapter: WindowAdapter } | null = null;
    const engine = {
      executeBatch: (_commands: unknown, context: { root: unknown; focused: unknown; adapter: WindowAdapter }) => {
        captured = { root: context.root, focused: context.focused, adapter: context.adapter };
        return [{ success: true }];
      },
    } as unknown as CommandEngine;

    const service = buildCommandService({
      engine,
      adapter,
      getRoot: () => root as never,
      getFocused: () => null,
    });

    service.execute("focus left");

    expect(captured).toEqual({ root, focused: null, adapter });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- --filter="command service"`
Expected: FAIL with module not found for `src/commands/service.js`.

**Step 3: Write minimal implementation**

```ts
import type { RootContainer } from "../tree/root-container.js";
import type { Container } from "../tree/container.js";
import type { CommandEngine } from "./engine.js";
import type { WindowAdapter } from "./adapter.js";
import type { CommandResult } from "./types.js";
import { parseCommandString } from "./parser.js";
import { findFocusedContainer } from "./index.js";

interface CommandServiceDeps {
  engine: CommandEngine;
  adapter: WindowAdapter;
  getRoot: () => RootContainer | null;
  getFocused?: (root: RootContainer) => Container | null;
  logger?: (message: string) => void;
}

export interface CommandService {
  execute: (command: string) => CommandResult[];
}

export function buildCommandService(deps: CommandServiceDeps): CommandService {
  const getFocused = deps.getFocused ?? findFocusedContainer;

  return {
    execute: (command: string) => {
      const root = deps.getRoot();
      if (!root) {
        return [{ success: false, message: "Root container is not ready" }];
      }

      const commands = parseCommandString(command);
      const focused = getFocused(root);

      return deps.engine.executeBatch(commands, {
        root,
        focused,
        adapter: deps.adapter,
        logger: deps.logger,
      });
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- --filter="command service"`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/commands/service.test.ts src/commands/service.ts
git commit -m "feat(commands): add shared command service"
```

---

### Task 2: Wire service into extension and IPC execute

**Files:**
- Modify: `src/extension.ts`

**Step 1: Write the failing test (behavioral)**

Manual fail check: IPC execute and `__tessera.execute` should use the same service instance; set a breakpoint/log to confirm both call the shared service. (No unit test available without heavy GNOME mocks.)

**Step 2: Update extension wiring**

Replace the local `executeCommand` function with a `CommandService` built once during enable:

```ts
import { buildCommandService } from "./commands/service.js";

const engine = buildCommandEngine();
registerDefaultHandlers(engine);

const adapter: WindowAdapter = {
  activate: (window) => window.activate(global.get_current_time()),
  moveResize: (window, rect) => window.move_resize_frame(true, rect.x, rect.y, rect.width, rect.height),
  setFullscreen: (window, fullscreen) => fullscreen ? window.make_fullscreen() : window.unmake_fullscreen(),
  setFloating: (window, floating) => floating ? window.make_above() : window.unmake_above(),
  close: (window) => window.delete(global.get_current_time()),
  exec: (command) => GLib.spawn_command_line_async(command),
};

const commandService = buildCommandService({
  engine,
  adapter,
  getRoot: () => root,
});

globalThis.__tessera = {
  root,
  tracker,
  tree: () => root?.toJSON() ?? null,
  execute: (command) => commandService.execute(command),
};

const ipcHandlers = {
  execute: (command: string) => commandService.execute(command),
  tree: () => root?.toJSON() ?? null,
  ping: () => ({ ok: true }),
  version: () => ({ uuid: Me.uuid, version: Me.metadata.version ?? "unknown" }),
  debug: () => buildDebugPayload(...),
  config: (params) => { applyConfig(params); return config; },
};
```

Make sure the old `executeCommand` helper is removed and there is only one engine instantiation.

**Step 3: Manual verification**

Run in nested shell:

```bash
make nested
TESSERA_IPC=1 gnome-extensions enable tessera@christians.dev
bunx tsx scripts/ipc-run.ts execute "splitv; focus right; move left; resize grow width 20 px"
bunx tsx scripts/ipc-run.ts execute "[app_id=\"firefox\"] focus; floating toggle; fullscreen toggle"
```

Expected: same command results as `globalThis.__tessera.execute` and the window actions apply.

**Step 4: Commit**

```bash
git add src/extension.ts
git commit -m "refactor(extension): route execute through command service"
```

---

### Task 3: Update phase-2 command system doc

**Files:**
- Modify: `docs/plans/2026-02-15-phase-2-command-system.md`

**Step 1: Add IPC execute notes**

Add a short section describing the new shared service and the IPC execute manual test commands (reuse the commands from Task 2).

**Step 2: Commit**

```bash
git add docs/plans/2026-02-15-phase-2-command-system.md
git commit -m "docs: note IPC execute shared service"
```

---

### Task 4: Full verification (optional before merge)

**Step 1: Run full check**

Run: `bun run check`
Expected: lint, build, and tests pass.

**Step 2: Commit if any follow-up fixes are required**

```bash
git add -A
git commit -m "fix: address lint or test failures"
```
