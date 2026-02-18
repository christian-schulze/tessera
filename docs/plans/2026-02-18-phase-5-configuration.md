# Phase 5 Configuration Implementation Plan

**Goal:** Extend `~/.config/tessera/config.js` with a full configuration surface: custom keybinding modes, window rules, layout gaps, focused window border, workspace-output assignments, startup exec, and exec-capture.

**Scope:** All sub-features are self-contained. Each can be landed independently. No new IPC commands; existing `reload` command applies config at runtime.

---

## Architecture

- `src/config.ts` is the central config module. All new fields are normalised there and surfaced via `TesseraConfig`.
- The config JS file is evaluated in a `new Function()` sandbox. A `tessera` helper object is injected so configs can call `tessera.defaults.buildDefaultBindingModes()`.
- Each sub-feature is implemented in its own module and wired into `extension.ts`.

---

## Sub-Feature 5A: Config Types and Validation

**Goal:** Add types and normalizers for all new config fields so later sub-features have a clean API.

**Files:**
- Modify: `src/config.ts`

**New types:**

```ts
export interface GapsConfig { inner: number; outer: number; }
export interface FocusedBorderConfig { color: string; width: number; }
export interface RuleCriteria { app_id?: string; title?: string; }
export interface ForWindowRule { match: RuleCriteria; commands: string[]; }
export type WorkspaceOutputMap = Record<string, number>;
```

**Extended `TesseraConfig`:**
- `gaps?: GapsConfig`
- `focusedBorder: FocusedBorderConfig`
- `modes?: BindingMode[]`
- `rules: ForWindowRule[]`
- `workspaceOutputs: WorkspaceOutputMap`
- `exec: string[]`

**Notes:**
- Each field has a normalizer (`normalizeGaps`, `normalizeFocusedBorder`, etc.) that coerces and validates raw config values.
- `applyConfig()` calls all normalizers and mutates the config object in place.
- `loadConfig()` injects `tessera.defaults.buildDefaultBindingModes` so configs can extend the default preset.

---

## Sub-Feature 5B: Custom Keybindings from Config

**Goal:** Allow the config file to supply custom binding modes that replace the built-in defaults.

**Files:**
- Modify: `src/bindings/manager.ts` — add `clearModes()`
- Create: `src/bindings/reload.ts` — `reloadBindings(manager, config)`
- Modify: `src/extension.ts` — use `config.modes ?? buildDefaultBindingModes()`; wire `reloadBindings` into `reloadConfig`

**Key design:**
- `reloadBindings` disables, clears, and re-registers all modes from the new config.
- Falls back to built-in defaults if `config.modes` is absent.
- Called on `reload` command and on config change.

---

## Sub-Feature 5C: `for_window` Rules Engine

**Goal:** Run commands automatically when a window is tracked (i.e. first appears).

**Files:**
- Create: `src/rules.ts` — `evaluateRules(rules, container)` returns `string[]`
- Modify: `src/commands/service.ts` — add `executeForTarget(command, target)` to `CommandService`
- Modify: `src/window-tracker.ts` — evaluate rules after `trackWindow`, execute via `options.executeForTarget`

**Matching criteria:**
- `app_id` — matched against `Meta.Window.get_wm_class()`
- `title` — matched against `Meta.Window.get_title()`

**Notes:**
- Rules are evaluated once per window when first tracked.
- Each matched rule's commands are executed with the new window's container as the focused target.

---

## Sub-Feature 5D: Layout Gaps and Focused Border

**Goal:** Add configurable gaps between tiles and a visual border around the focused window.

### Gaps

**Files:**
- Modify: `src/tree/reflow.ts` — subtract `gaps.outer` from workspace rect; subtract `gaps.inner` between children
- Modify: `src/commands/handlers/core.ts`, `src/commands/handlers/workspace.ts` — pass `context.config.gaps` to all `reflow()` calls
- Modify: `src/window-tracker.ts` — pass `this.getConfig().gaps` to all `reflow()` calls

**Key design:**
- Outer gaps applied once at the workspace level; child reflows strip `outer` to avoid doubling.
- Inner gaps split half-and-half between adjacent children.

### Focused Border

**Files:**
- Create: `src/focus-border.ts` — `FocusBorder` class using St.Widget overlay

**Key design:**
- `FocusBorder` accepts `St` and `layoutManager` as constructor deps (dependency injection) to avoid legacy `globalThis.imports` usage in GJS ESM modules.
- Widget is added via `Main.layoutManager.addTopChrome()` so it renders above windows.
- Border is drawn **inside** the window rect (actor positioned at `rect.x, rect.y` with size `rect.width, rect.height`) to prevent overflow into the GNOME panel.
- `updatePosition(rect)` called on `onFocusChanged` and `onLayoutApplied` callbacks from `WindowTracker`.
- `onAfterExecute` in `CommandService` triggers an immediate update plus a 100ms delayed update to handle async GNOME workspace transitions where focus settles after an idle callback.

---

## Sub-Feature 5E: Workspace-Output Assignment

**Goal:** Pin specific workspaces to specific monitors in multi-monitor setups.

**Files:**
- Modify: `src/tree/tree-builder.ts` — skip monitor/workspace combinations not matching `workspaceOutputs`
- Modify: `src/extension.ts` — pass `config.workspaceOutputs` to `TreeBuilder.build()`

**Config format:**

```js
workspaceOutputs: {
  "1": 0,  // workspace 1 → monitor 0
  "2": 1,  // workspace 2 → monitor 1
}
```

---

## Sub-Feature 5F: Exec Capture and Startup Exec

**Goal:** Run commands at startup and support exec-capture for async command output.

**Files:**
- Modify: `src/commands/adapter.ts` — add optional `execCapture` method
- Create: `src/commands/handlers/process.ts` — `execCaptureHandler`
- Modify: `src/commands/index.ts` — register `execCaptureHandler`
- Modify: `src/extension.ts` — implement `execCapture` using `Gio.Subprocess`; run `config.exec` on enable

**Notes:**
- `execCapture` returns a `Promise<{ stdout, stderr, exitCode }>`.
- Startup `exec` commands are fired with `GLib.spawn_command_line_async` after the extension is fully enabled.

---

## Error Handling

- Config parse errors are caught and logged; extension falls back to `DEFAULT_CONFIG`.
- Rule evaluation errors are caught per-rule and logged; other rules still run.
- `execCapture` errors are caught and returned as `{ ok: false, error }` via IPC.
- `exec` startup failures are logged and skipped; remaining commands still run.

---

## Testing

**Unit tests (Jasmine, 165 specs):**
- `src/config.ts` normalizers — valid inputs, clamping, defaults (20+ cases)
- `src/bindings/reload.ts` — reload replaces modes, falls back to defaults
- `src/rules.ts` — app_id match, title match, no match, multiple rules
- `src/commands/handlers/process.ts` — exec, exec-capture success and failure
- `src/tree/tree-builder.ts` — workspace-output filtering on multi-monitor builds

**Manual testing:**
- `make nested` to verify gaps, border, keybinding reload, rules, and workspace-output assignment.
- `make logs` to confirm startup exec and rule evaluation log output.
