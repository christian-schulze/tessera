# Tessera Agent Guide

Instructions for coding agents working in this repository.

## Core Rule
- Keep changes minimal, match existing conventions, and prefer focused diffs.

## Project Overview
- Tessera is an i3-like tiling window manager for GNOME Shell.
- Primary runtime is GNOME Shell 49; tooling uses Bun and TypeScript.
- Extension UUID: `tessera@tessera.dev`.

## Quick Commands
- Install deps: `bun install`
- Build: `make build`
- Lint: `make lint`
- Test: `make test`
- Full check: `make check`
- Install locally: `make install`
- Enable extension: `make enable` (or `gnome-extensions enable tessera@tessera.dev`)
- Disable extension: `make disable`
- Uninstall: `make uninstall`

Notes:
- `make` targets are the preferred command interface for agents.
- Bun equivalents exist in `package.json` (`bun run build|lint|test|check`).

## Before Changing Code
- Review `docs/decisions.md` for prior rationale.
- Check `docs/learnings.md` for known pitfalls.

## Must-Follow Conventions

### TypeScript / ESM
- Use ESM imports with explicit `.js` extensions for local modules.
- Prefer `import type` for type-only imports.
- Keep strict typing; avoid `any`.
- Use `unknown` for external values and narrow before use.

### Imports and Formatting
- Order imports as: external URLs, `gi://` modules, then local relative imports.
- Follow existing formatting in touched files.
- Avoid formatting-only diffs unless required.

### Runtime / Error Handling
- Do not throw across IPC boundaries; return `{ ok: false, error: ... }`.
- Use `try/catch` where GNOME Shell operations may fail.
- Use `logError` when catching unexpected GNOME Shell errors.
- Ensure enable/disable cleanly creates and tears down signals/objects.

### GNOME Shell Constraints
- Avoid deprecated modules (Lang, ByteArray, Mainloop).
- Do not use GTK inside GNOME Shell.
- Do not ship obfuscated or minified code.

## Debugging
- Tail extension logs: `make logs` (`~/.local/state/tessera/tessera.log`)
- Run nested shell: `make nested` (IPC is enabled by default; set `TESSERA_IPC=0` to disable)
- Tail nested logs: `make logs-nested` (`~/.local/state/tessera/nested-gnome-shell.log`)
- IPC helpers: `make ipc-tree`, `make ipc-debug`
- Looking Glass: `make looking-glass`
- Log timestamps are in UTC (not local time).

### Agent Debugging Workflow (Do This First)
- Do not ask the user to paste logs until you have attempted to read available logs directly.
- Prefer self-service diagnostics first (`make logs`, `make logs-nested`, `make ipc-tree`, `make ipc-debug`, and direct log-file reads).
- `make logs` and `make logs-nested` already follow/tail internally; do not pipe them to `tail`/`head` in automation (they will not terminate). For bounded output, read the log files directly (e.g. `read ~/.local/state/tessera/tessera.log` with offsets or `tail -n` on the file path itself).
- Include relevant command output and concise log excerpts in your response.
- Ask the user for additional logs only if required context is inaccessible from the agent session.
- If you need user input, request the smallest specific artifact (exact command and short range), not entire logs.
- Use Python for JSON parsing/inspection when analyzing structured logs or command output.

## Running Targeted Tests
- Single test file:
  - `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --spec=tests/unit/commands/parser.test.ts`
- Filter by name:
  - `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --filter="parser"`

## Project Structure
- `src/` TypeScript source for extension logic.
- `src/ipc/` IPC server and codecs for CLI/config.
- `src/commands/` Command parsing and handlers.
- `src/tree/` Container tree and layout logic.
- `tests/` Jasmine unit tests.
- `dist/` Build output.

## Working with Changes
- Keep commits focused; avoid mixing refactors with behavior changes.
- Prefer small, incremental edits to minimize risk in GNOME Shell.
- If adding new IPC handlers, update types and tests together.
