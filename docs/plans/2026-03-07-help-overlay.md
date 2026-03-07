# Binding Help Overlay implementation plan

## Context
- Add a floating overlay that shows the current mode’s keybindings.
- The overlay is opened only by an explicit help binding (not automatically on mode entry).
- Desired defaults are now fixed:
  - help key toggles hide/show (`Super+Shift+?`, mapped to the correct GTK accelerator token),
  - auto-hide on focus change,
  - auto-hide on workspace switch.

## Approach
- Implement a dedicated `BindingHelpOverlay` UI class, modeled after `InspectOverlay` (`St.BoxLayout` + labels attached to `global.window_group`).
- Expose minimal read/update hooks from `BindingManager` so extension code can get the active mode bindings and react to mode switches.
- Add a new command handler (parallel to `inspect`) to toggle the help overlay from keybindings/IPC.
- Keep behavior fixed (no config schema changes).
- Keep overlay state simple:
  - explicit toggle controls visibility,
  - mode changes refresh content only if already visible,
  - focus/workspace changes hide.

## Files to modify
- `src/bindings/manager.ts`
  - Add read helpers for active mode data (e.g., mode name + bindings).
  - Add optional mode-change callback hook so UI can refresh when mode changes.
- `src/bindings/defaults.ts`
  - Add default help binding in default mode (`Super+Shift+?` intent mapped to valid accelerator token).
- `src/binding-help-overlay.ts` (new)
  - New overlay class for rendering mode name + bindings.
- `src/commands/context.ts`
  - Add `toggleBindingHelp?: () => void` callback in command context.
- `src/commands/service.ts`
  - Add matching dep and pass through to command context.
- `src/commands/handlers/help.ts` (new)
  - Add `binding-help` command handler that calls `context.toggleBindingHelp?.()`.
- `src/commands/index.ts`
  - Register new `binding-help` handler.
- `src/extension.ts`
  - Create/destroy `BindingHelpOverlay`.
  - Wire command callback to toggle overlay with active mode snapshot from `BindingManager`.
  - Hide overlay in existing focus-change path (`WindowTracker` callback) and on workspace change.
  - Wire mode-change callback to refresh overlay content when visible.
- `docs/configuration.md`
  - Add default keybinding row for binding help overlay.
- Tests:
  - `tests/unit/bindings/defaults.test.ts`
  - `tests/unit/commands/service.test.ts`
  - `tests/unit/commands/engine.test.ts` (or dedicated handler test file)

## Reuse
- Overlay implementation patterns:
  - `src/inspect-overlay.ts` (panel lifecycle, workspace change signal wiring, refresh/hide semantics)
  - `src/focus-border.ts` (actor attach/reparent style)
- Command plumbing:
  - `src/commands/handlers/inspect.ts`
  - `src/commands/context.ts`
  - `src/commands/service.ts`
  - `src/commands/index.ts`
- Mode control:
  - `src/bindings/manager.ts` (`switchMode`, current mode storage)
  - `src/commands/handlers/core.ts` (`mode` command path)
- Documentation/table conventions:
  - `docs/configuration.md` default keybindings section

## Steps
- [ ] Add `BindingManager` read/callback support needed by overlay integration:
  - [ ] expose active mode name and binding list snapshot,
  - [ ] emit optional callback from `switchMode()` after successful switch.
- [ ] Add `binding-help` command plumbing:
  - [ ] add `toggleBindingHelp` to command context/service deps,
  - [ ] add/register handler that calls the callback.
- [ ] Implement `src/binding-help-overlay.ts`:
  - [ ] create hidden panel actor,
  - [ ] render title + active mode name + key/command rows,
  - [ ] implement `show`, `hide`, `toggle`, `refresh`, `destroy`,
  - [ ] hide on workspace switch via `active-workspace-changed` signal.
- [ ] Integrate in `src/extension.ts`:
  - [ ] instantiate/destroy overlay,
  - [ ] wire `toggleBindingHelp` to use current mode snapshot,
  - [ ] hide on focus changes in existing `onFocusChanged` callback,
  - [ ] refresh visible overlay on mode switches.
- [ ] Add default keybinding in `src/bindings/defaults.ts` for help toggle (mapped accelerator for `Super+Shift+?`).
- [ ] Update docs + tests:
  - [ ] docs row in `docs/configuration.md`,
  - [ ] defaults test asserts help binding presence,
  - [ ] command/service tests for new callback wiring and handler execution.

## Verification
- Static/test checks:
  - `make build`
  - `make test`
- Manual (real GNOME session):
  - `make build`
  - `make install`
  - Log out and back in (or restart GNOME Shell session) so the updated extension is loaded.
  - Ensure extension is enabled (`make enable` or `gnome-extensions enable tessera@tessera.dev`).
  - Press help binding in default mode → overlay shows default mode bindings.
  - Press help binding again → overlay hides.
  - With overlay visible, enter `resize` mode (`Super+R`) → overlay content updates to resize bindings (still visible).
  - Change focus to another window → overlay hides.
  - Switch workspace → overlay hides.
  - Reopen overlay in new workspace and confirm bindings render correctly.
  - Confirm existing inspect overlay (`Super+I`) and dump tree (`Super+Shift+I`) still behave unchanged.

## Findings from code scan
- `BindingManager` currently has no outward mode-change callback and no accessor for active mode bindings; this is the main missing integration seam.
- `InspectOverlay` already demonstrates workspace-driven hiding via `active-workspace-changed`; same signal is appropriate for help overlay.
- Focus changes are already centrally observed in `WindowTracker` (`notify::focus-window`) and surfaced via `extension.ts` `onFocusChanged`; this is the best hide hook.
- No config extension is needed for current requirements (fixed defaults).
