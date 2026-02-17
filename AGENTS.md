# Tessera Agent Guide

This file is for agentic coding tools operating in this repo.
Keep changes minimal, match existing conventions, and prefer focused diffs.

## Project Overview
- Tessera is an i3-like tiling window manager for GNOME Shell.
- Primary runtime is GNOME Shell 49; tooling uses Bun and TypeScript.
- Extension UUID: `tessera@tessera.dev`.

## Quick Commands

### Install Dependencies
- `bun install`

### Build
- `bun run build`
- Makefile: `make build`

### Lint
- `bun run lint`
- Makefile: `make lint`

### Test
- `bun run test`
- Makefile: `make test`

### Full Check
- `bun run check`
- Makefile: `make check`

### Install/Enable Extension Locally
- `make build`
- `make install`
- `gnome-extensions enable tessera@tessera.dev`

### Uninstall
- `make uninstall`

### Restart Extension
- `make restart`

### Nested Shell (Debugging)
- `make nested`
- `TESSERA_IPC=1 make nested` (explicit IPC)

### Looking Glass (Debug)
- `make looking-glass`

## Running a Single Test

Tests run with Jasmine via tsx and a config file.

### Run One Test File
- `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --spec=tests/unit/commands/parser.test.ts`

### Run One Test by Name
- `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="parser"`

### Common Test Locations
- `tests/unit/**/*.test.ts`

## Code Style and Conventions

### TypeScript / ESM
- Use ESM imports with explicit `.js` extensions for local modules.
- Prefer `import type` for type-only imports.
- Keep `strict` typing; avoid `any`.
- Use `unknown` for external values and narrow with checks or casts.
- Prefer explicit return types for exported helpers and public APIs.

### Imports
- Order imports as: external URLs, `gi://` modules, then local relative imports.
- Group related imports and avoid unused imports.

### Formatting
- Follow existing formatting in the file; keep diffs minimal.
- Avoid reformat-only changes unless necessary for your work.

### Naming
- Use `camelCase` for variables/functions, `PascalCase` for types/classes.
- Enums use `PascalCase` names with string values.
- Booleans read as predicates (`isEnabled`, `hasFocus`, `canSplit`).

### Functions and Classes
- Prefer `const name = (...) => {}` for functions.
- Keep functions small and focused.
- Avoid mutating shared state unless required.
- Use private fields with explicit types and nullable state for lifecycle.

### Error Handling
- Do not throw across IPC boundaries; return `{ ok: false, error: ... }`.
- Use `try/catch` where GNOME Shell operations may fail.
- Use `logError` for GNOME Shell logging when catching unexpected errors.
- Clean up resources on stop/disable, and ignore safe cleanup failures.

### GNOME Shell Guidelines
- Avoid deprecated modules (Lang, ByteArray, Mainloop).
- Do not use GTK inside GNOME Shell.
- Ensure enable/disable cleanly creates and tears down signals/objects.
- Do not ship obfuscated or minified code.

## Project Structure
- `src/` TypeScript source for extension logic.
- `src/ipc/` IPC server and codecs for CLI/config.
- `src/commands/` Command parsing and handlers.
- `src/tree/` Container tree and layout logic.
- `tests/` Jasmine unit tests.
- `dist/` Build output (ignored by lint).

## Configuration and IPC
- Local config file: `~/.config/tessera/config.js` (module.exports settings).
- Runtime config via IPC:
  - `bunx tsx scripts/ipc-run.ts config 300`
  - `bunx tsx scripts/ipc-run.ts execute "splitv; focus right"`

## Tooling Notes
- TypeScript builds to `dist/` with `module=NodeNext`.
- ESLint ignores `dist/`, `node_modules/`, and `tests/`.
- Jasmine runs specs from `tests/unit/**/*.test.ts`.

## Working with Changes
- Keep commits focused; avoid mixing refactors with behavior changes.
- Prefer small, incremental edits to minimize risk in GNOME Shell.
- If adding new IPC handlers, update types and tests together.

## Debugging
- Check `docs/learnings.md` and `docs/decisions.md` before starting.

## Planning
- Review `docs/decisions.md` for prior rationale before proposing changes.

## No Cursor/Copilot Rules Found
- `.cursor/rules/`, `.cursorrules`, and `.github/copilot-instructions.md` not present.
