# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tessera is an i3-like tiling window manager implemented as a GNOME Shell 49 extension. Runtime is GJS (GNOME JavaScript); tooling uses Bun and TypeScript. Extension UUID: `tessera@tessera.dev`.

## Commands

```bash
bun install                # install dependencies
bun run build              # compile TypeScript → dist/
bun run lint               # ESLint on src/
bun run test               # Jasmine unit tests
bun run check              # lint + build + test

make build                 # compile + copy metadata.json
make install               # symlink dist/ into GNOME Shell extensions dir
make nested                # launch nested GNOME Shell for debugging
make logs                  # tail ~/.local/state/tessera/tessera.log
make logs-nested           # tail nested GNOME Shell log
make ipc-tree              # query container tree via IPC
make ipc-debug             # query debug info via IPC
```

Run a single test file:
```bash
bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --spec=tests/unit/commands/parser.test.ts
```

Run tests matching a name:
```bash
bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="parser"
```

## Architecture

### Container Tree

The core data structure is a tree representing the tiling layout:

```
RootContainer → OutputContainer (per monitor) → WorkspaceContainer → SplitContainer → WindowContainer
```

- `RootContainer` — single root, owns all outputs
- `OutputContainer` — one per physical monitor, owns workspaces
- `WorkspaceContainer` — one per GNOME workspace on that output
- `SplitContainer` — holds children in SplitH (horizontal) or SplitV (vertical) orientation; nestable
- `WindowContainer` — leaf node wrapping a `Meta.Window`

All container types extend `Container` (`src/tree/container.ts`). Tree normalization and reflow logic in `src/tree/reflow.ts` ensures structural invariants (e.g., collapsing single-child splits). Geometry is computed from the tree and applied to windows via `src/tree/apply-layout.ts`.

### Command System

Commands flow through a pipeline: string → parser → engine → handler → adapter.

- `CommandParser` (`src/commands/parser.ts`) — tokenizes command strings like `"splitv; focus right"` into `Command[]`
- `CommandEngine` (`src/commands/engine.ts`) — registry of named handlers, dispatches commands
- Handlers (`src/commands/handlers/`) — implement focus, move, split, layout, workspace, and process commands
- `WindowAdapter` (`src/commands/adapter.ts`) — interface abstracting GNOME Shell window operations so handlers stay testable

### IPC

Unix socket server (`src/ipc/server.ts`) using `Gio.SocketService`. Socket at `${XDG_RUNTIME_DIR}/tessera.GNOME-Shell-${pid}`. Binary codec in `src/ipc/codec.ts`. CLI tool at `scripts/ipc-run.ts`.

Handlers: `execute`, `tree`, `ping`, `version`, `debug`, `config`.

### Window Tracking

`WindowTracker` (`src/window-tracker.ts`) connects to Meta.Display signals for window lifecycle events (map, unmap, focus, workspace-change). On changes it triggers tree updates and `applyLayout()`. Focus tracking in `src/tree/focus.ts`; overflow/fullscreen handling in `src/window-tracker-overflow.ts`.

### Keybinding System

`BindingManager` (`src/bindings/manager.ts`) registers keybindings with GNOME Shell. Supports named modes (`BindingMode`) — sets of keybindings that can be swapped at runtime. Default bindings in `src/bindings/defaults.ts` use vim-style hjkl navigation.

### Layout Strategies

`src/layout/strategy.ts` provides insertion strategies: normal split vs alternating layout. Alternating layout auto-selects split orientation based on container aspect ratio. Configuration via `~/.config/tessera/config.js`.

### Extension Lifecycle

`src/extension.ts` — main entry point. `enable()` builds the container tree from current windows/monitors, starts window tracking, IPC server, and keybindings. `disable()` tears everything down. `src/extension-rebuild.ts` handles monitor hotplug by rebuilding the tree.

## Code Conventions

- ESM imports with explicit `.js` extensions for local modules
- `import type` for type-only imports
- Strict TypeScript; no `any` — use `unknown` and narrow
- Import order: external URLs → `gi://` modules → local relative imports
- `camelCase` functions/variables, `PascalCase` types/classes, boolean predicates (`isEnabled`, `hasFocus`)
- Prefer `const name = (...) => {}` arrow functions
- Do not throw across IPC boundaries; return `{ ok: false, error: ... }`
- GNOME Shell compliance: no deprecated modules (Lang, ByteArray, Mainloop), no GTK inside Shell, clean enable/disable lifecycle

## Key Design Decisions

- `Meta.Window.move_resize_frame()` uses `user_op = false` for programmatic layout — see `docs/decisions.md`
- Read `docs/learnings.md` for Mutter resize behavior notes before investigating size/layout issues
- Planning docs in `docs/plans/` contain detailed rationale for major features
