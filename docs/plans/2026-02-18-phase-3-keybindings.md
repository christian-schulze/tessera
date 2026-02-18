# Phase 3 Keybindings Implementation Plan

**Goal:** Add a binding manager with modal modes, an i3-like default preset (including move and close bindings), and reload binding support.

**Scope:** Minimal Phase 3. No config-driven custom bindings yet (defer to Phase 5).

---

## Architecture

- `BindingManager` owns GNOME Shell keybinding registration and active mode state.
- Modes are data-only (`BindingMode`, `Binding`).
- Default preset is defined in a factory and loaded by `extension.ts`.
- Bindings execute command strings via `CommandEngine.execute`.
- `mode` command triggers `BindingManager.switchMode`.
- IPC notifications for mode changes are deferred to Phase 4.

---

## Data Types

```ts
export interface Binding {
  keys: string[];
  command: string;
  release?: boolean;
}

export interface BindingMode {
  name: string;
  bindings: Binding[];
}
```

---

## Default Preset (i3-style)

**Default mode:**
- Focus: `$mod+h/j/k/l` -> `focus left/down/up/right`
- Move: `$mod+Shift+h/j/k/l` -> `move left/down/up/right`
- Split: `$mod+b` -> `split horizontal`, `$mod+v` -> `split vertical`
- Layout toggle: `$mod+e` -> `layout toggle split`
- Fullscreen: `$mod+f` -> `fullscreen toggle`
- Kill: `$mod+Shift+q` -> `kill`
- Workspaces: `$mod+1..9` -> `workspace 1..9`
- Move to workspace: `$mod+Shift+1..9` -> `move container to workspace 1..9`
- Reload: `$mod+Shift+r` -> `reload`
- Resize mode: `$mod+r` -> `mode "resize"`

**Resize mode:**
- `h` -> `resize shrink width 10 px`
- `l` -> `resize grow width 10 px`
- `k` -> `resize shrink height 10 px`
- `j` -> `resize grow height 10 px`
- `Escape` -> `mode "default"`

---

## Implementation Tasks

### Task 1: Add binding types and defaults

**Files:**
- Create: `src/bindings/mode.ts`
- Create: `src/bindings/defaults.ts`

**Notes:**
- `defaults()` returns `BindingMode[]` with default + resize modes.

---

### Task 2: Binding manager

**Files:**
- Create: `src/bindings/manager.ts`

**Responsibilities:**
- `addMode(name, bindings)`
- `switchMode(name)` unregisters old bindings and registers new ones
- `enable()` registers active mode bindings
- `disable()` unregisters all bindings
- `getActiveMode()` returns active mode name
- Best-effort error handling; log and continue on conflicts

---

### Task 3: Wire into extension

**Files:**
- Modify: `src/extension.ts`

**Notes:**
- Instantiate `BindingManager` with `Gio.Settings` and `CommandEngine`.
- Load defaults and set active mode to `default`.
- On disable, unregister bindings.

---

### Task 4: Connect mode command

**Files:**
- Modify: `src/commands/handlers/mode.ts`

**Notes:**
- Inject `BindingManager` into handler registration so `mode` command switches active mode.

---

## Error Handling

- Registration errors (already bound keys) should be logged and skipped.
- `switchMode` should avoid leaving no bindings: if mode missing, warn and keep current.
- Command execution errors should not throw; log and continue.

---

## Testing

**Unit tests (Jasmine):**
- `defaults()` includes move bindings and kill binding.
- `switchMode` registers/unregisters expected keys with a mock settings interface.
- Binding callback executes `CommandEngine.execute` with the correct command string.

**Manual testing:**
- `make nested` and confirm default bindings work (focus, move, kill, resize mode, reload).
- Custom bindings are deferred to Phase 5 (config parser).
