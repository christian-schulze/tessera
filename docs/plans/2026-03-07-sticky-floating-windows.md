# Sticky floating windows across all workspaces — plan

## Context
We want floating windows to support a **sticky** flag so they render on every workspace. The sticky flag must be:
- togglable by command + default keybinding,
- configurable via custom `modes` (existing config mechanism), and
- usable in window `rules` (same flow as `floating enable`).

User decisions captured:
- Command shape: `sticky on|off|toggle` (also support `enable|disable` aliases).
- Sticky on non-floating windows: **reject with an error** (do not auto-float).
- Include command criteria support for sticky.
- Proposed default binding: **`Super+Shift+S` → `sticky toggle`**.

## Approach
Implement sticky as a first-class `WindowContainer` boolean (`sticky`), mirror the existing `floating/fullscreen` command pattern, and bridge to GNOME Shell via adapter method(s) that call Mutter sticky APIs.

Rules already execute arbitrary commands for matched windows, so once `sticky` is a command, rules can use it directly (e.g. `"floating enable"; "sticky enable"`).

Criteria support is added by extending command criteria evaluation with `sticky` and `non_sticky`, following the existing `floating`/`tiling` boolean criterion pattern.

## Files to modify
- `src/tree/window-container.ts`
- `src/commands/handlers/workspace.ts`
- `src/commands/index.ts`
- `src/commands/adapter.ts`
- `src/extension.ts`
- `src/bindings/defaults.ts`
- `src/commands/criteria.ts`
- `src/inspect-overlay.ts` (display sticky state alongside floating/fullscreen)
- `docs/configuration.md`
- `tests/unit/window-container.test.ts`
- `tests/unit/commands/handlers/workspace.test.ts`
- `tests/unit/commands/criteria.test.ts`

## Reuse
- Toggle handler structure and mode parsing:
  - `src/commands/handlers/workspace.ts` (`floatingHandler`, `fullscreenHandler`)
- Command registration:
  - `src/commands/index.ts`
- Boolean criteria evaluation utility:
  - `src/commands/criteria.ts` (`evaluateBoolean`, existing `floating` / `tiling` branches)
- Default keybinding source:
  - `src/bindings/defaults.ts`
- Rules execution path (already target-scoped and reusable):
  - `src/rules.ts` + `src/window-tracker.ts` (`evaluateRules` + `executeForTarget`)

## Steps
- [ ] Add `sticky: boolean` to `WindowContainer` with default `false`, and include it in `toJSON()`.
- [ ] Extend `WindowAdapter` with sticky support as an **optional** method (`setSticky?: ...`) to avoid broad test/mocking churn.
- [ ] Implement sticky bridge in `extension.ts` using Mutter window sticky APIs (`stick`/`unstick`) through adapter wiring.
- [ ] Add `stickyHandler` in `workspace.ts`:
  - [ ] Accept `on/off/toggle/enable/disable`.
  - [ ] Return error if focused container is not a window.
  - [ ] Return error if enabling/toggling-on while `floating === false`.
  - [ ] Update `focused.sticky` and call adapter sticky method.
- [ ] Register new handler in `src/commands/index.ts`.
- [ ] Add default binding in `src/bindings/defaults.ts`: `Super+Shift+S` → `sticky toggle`.
- [ ] Extend criteria matching in `src/commands/criteria.ts`:
  - [ ] `sticky` evaluates `container.sticky`
  - [ ] `non_sticky` evaluates `!container.sticky`
- [ ] Update inspect output to show sticky state for easier debugging.
- [ ] Update docs (`docs/configuration.md`):
  - [ ] Default keybindings table with `Super+Shift+S`.
  - [ ] Available commands list with sticky command variants.
  - [ ] Rules examples mentioning sticky usage.
- [ ] Add/update tests:
  - [ ] `window-container.test.ts` for sticky defaults + JSON serialization.
  - [ ] `workspace.test.ts` for sticky toggle, sticky error when non-floating, and adapter invocation.
  - [ ] `criteria.test.ts` for `sticky` / `non_sticky` criteria behavior.

## Verification
- Run targeted tests:
  - `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --spec=tests/unit/window-container.test.ts`
  - `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --spec=tests/unit/commands/handlers/workspace.test.ts`
  - `bunx tsx ./node_modules/jasmine/bin/jasmine.js --config=tests/jasmine.json --spec=tests/unit/commands/criteria.test.ts`
- Run full suite: `make test`.
- Manual nested-shell verification (`make nested`):
  1. Open a normal window and run `floating enable`.
  2. Toggle sticky via `Super+Shift+S` (or `sticky toggle`).
  3. Switch workspaces; confirm the sticky floating window remains visible.
  4. Run `sticky off`; confirm window is no longer shown on every workspace.
  5. On a tiled window, run `sticky enable`; confirm command returns rejection error.
  6. Add a rule with `commands: ["floating enable", "sticky enable"]`; open matching app and confirm both apply.
