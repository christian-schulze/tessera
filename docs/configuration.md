# Configuration

Tessera is configured through a JavaScript file at `~/.config/tessera/config.js`. The file uses CommonJS `module.exports` and is evaluated at extension startup.

Changes take effect on reload (`Super+Shift+R` by default) or on GNOME Shell restart.

## Minimal Example

```js
module.exports = {
  minTileWidth: 400,
  gaps: { inner: 8, outer: 4 },
};
```

Only the fields you specify are applied; everything else keeps its default value.

## Alternating Layout

By default, Tessera uses a BSP-style *alternating* layout: each new window is nested in a split container whose axis alternates between horizontal and vertical, producing a balanced binary tree. For example, with four windows in focused mode:

```
┌─────────┬─────────┐
│    A    │    B    │
│         ├────┬────┤
│         │ C  │ D  │
└─────────┴────┴────┘
```

The `defaultAlternating` config key controls whether new workspace root splits start in this mode. To opt out globally, set `defaultAlternating: false`; all new workspaces will use a plain horizontal split instead.

The `alternating` flag can be toggled at runtime per-split with `Super+Shift+E` (default binding) or the `alternating on|off|toggle` command. This lets you mix plain and alternating splits in the same session.

The `alternatingMode` key controls *where* a new window is inserted within an alternating split:
- `"focused"` (default) — inserted next to the currently focused window
- `"tail"` — always appended at the tail of the tree

## Full Reference

```js
module.exports = {
  // Minimum window dimensions before a window is auto-floated.
  minTileWidth: 300,    // default: 300
  minTileHeight: 240,   // default: 240

  // Whether new workspace root splits start in alternating mode.
  // When true, windows are placed using the BSP-style alternating layout.
  // When false, new workspaces use plain SplitH.
  defaultAlternating: true, // default: true

  // Alternating layout insertion mode: "focused" inserts next to the
  // focused window, "tail" always appends at the end of the tree.
  alternatingMode: "focused", // default: "focused"

  // Gaps (in pixels) between tiled windows and workspace edges.
  gaps: {
    inner: 8,  // between windows (default: 0)
    outer: 4,  // between windows and screen edge (default: 0)
  },

  // Border drawn around the focused window.
  focusedBorder: {
    color: "#5294e2", // CSS color string (default: "" = disabled)
    width: 2,         // border width in pixels (default: 0)
  },

  // Colours for the Super+I inspect overlay.
  // All values are CSS color strings; omit the key to keep the default.
  inspectOverlay: {
    textColor:    "#39ff14",          // main text (default: neon green)
    headerColor:  "#1aab00",          // section headers (default: dimmer green)
    background:   "rgba(0,0,0,0.52)", // panel background (default: semi-transparent black)
  },

  // Keybinding modes. When present, replaces all default keybindings.
  // Set to null (or omit) to use defaults.
  modes: [
    {
      name: "default",
      bindings: [
        { keys: ["<Super>h"], command: "focus left" },
        { keys: ["<Super>j"], command: "focus down" },
        { keys: ["<Super>k"], command: "focus up" },
        { keys: ["<Super>l"], command: "focus right" },
        { keys: ["<Super>Return"], command: "exec alacritty" },
        // ...
      ],
    },
    {
      name: "resize",
      bindings: [
        { keys: ["h"], command: "resize shrink width 10 px" },
        { keys: ["l"], command: "resize grow width 10 px" },
        { keys: ["k"], command: "resize shrink height 10 px" },
        { keys: ["j"], command: "resize grow height 10 px" },
        { keys: ["Escape"], command: 'mode "default"' },
      ],
    },
  ],

  // Window rules evaluated when a window is first tracked.
  // Rules are processed in order; last write wins for conflicting properties.
  rules: [
    // Move all Firefox windows to workspace 2, but only normal windows (not dialogs)
    { match: { app_id: "firefox", window_type: "0" }, commands: ["move container to workspace 2"] },
    { match: { title: "Picture-in-Picture" }, commands: ["floating enable"] },
    { match: { app_id: "org.gnome.Nautilus" }, commands: ["floating enable"] },
  ],

  // Bind workspaces to specific monitors (workspace number -> monitor index).
  // Unassigned workspaces appear on all monitors.
  workspaceOutputs: {
    "1": 0,
    "2": 0,
    "3": 1,
  },

  // Commands to run at startup (fire-and-forget).
  exec: ["alacritty", "firefox"],
};
```

## Keybindings

### Default Keybindings

When `modes` is omitted or `null`, these defaults are used:

| Key | Command |
| --- | ------- |
| `Super+H/J/K/L` | Focus left/down/up/right |
| `Super+Shift+H/J/K/L` | Move (re-parent) window left/down/up/right |
| `Super+B` | Split horizontal |
| `Super+V` | Split vertical |
| `Super+E` | Toggle split layout |
| `Super+Shift+E` | Toggle alternating mode on focused split |
| `Super+F` | Toggle fullscreen |
| `Super+I` | Show/hide window inspect overlay |
| `Super+Shift+Q` | Close focused window |
| `Super+Shift+R` | Reload config |
| `Super+Shift+T` | Retile (reapply layout to all windows) |
| `Super+Shift+D` | Dump debug snapshot to `~/.local/state/tessera/debug.log` |
| `Super+Shift+I` | Dump tree snapshot to `~/.local/state/tessera/tree.log` |
| `Super+R` | Enter resize mode |
| `Super+1`..`9` | Switch to workspace 1-9 |
| `Super+0` | Switch to workspace 10 |
| `Super+Shift+1`..`9` | Move window to workspace 1-9 |
| `Super+Shift+0` | Move window to workspace 10 |

### Move vs Swap

`move left/right/up/down` — **re-parents** the focused window into the nearest container in that direction. In alternating splits this wraps the target window in a new perpendicular sub-split so the moved window nests alongside it (matching how a new window would be inserted with alternating layout). In plain splits it splices the window in adjacent to the target.

`swap left/right/up/down` — **swaps** the focused window with the nearest window in that direction, exchanging their positions in the tree without any re-nesting. `swap` has no default keybinding; add one via custom config or trigger it with IPC:

```bash
bunx tsx scripts/ipc-run.ts execute "swap left"
```

To bind `swap` to `Super+Shift+Ctrl+HJKL`, for example:

```js
const defaults = tessera.defaults.buildDefaultBindingModes();

defaults[0].bindings.push(
  { keys: ["<Super><Shift><Control>h"], command: "swap left" },
  { keys: ["<Super><Shift><Control>j"], command: "swap down" },
  { keys: ["<Super><Shift><Control>k"], command: "swap up" },
  { keys: ["<Super><Shift><Control>l"], command: "swap right" },
);

module.exports = { modes: defaults };
```

**Resize mode:**

| Key | Command |
| --- | ------- |
| `H` | Shrink width 10px |
| `L` | Grow width 10px |
| `K` | Shrink height 10px |
| `J` | Grow height 10px |
| `Escape` | Return to default mode |

### Custom Keybindings

When you set `modes`, it **replaces** all default keybindings. To extend the defaults instead, use the `tessera` helper available inside the config file:

```js
const defaults = tessera.defaults.buildDefaultBindingModes();

// Add a binding to the default mode
defaults[0].bindings.push({
  keys: ["<Super>Return"],
  command: "exec alacritty",
});

module.exports = {
  modes: defaults,
};
```

### Key Format

Keys use GTK accelerator syntax:

- Modifier keys: `<Super>`, `<Shift>`, `<Control>`, `<Alt>`
- Modifiers combine: `<Super><Shift>h`
- Letter keys are lowercase: `h`, `j`, `k`, `l`
- Special keys: `Return`, `Escape`, `Tab`, `space`
- Number keys: `1`, `2`, ..., `9`

## Window Rules

Rules are evaluated once when a window is first tracked. Each rule has a `match` object and a list of `commands` to execute on the matched window.

### Match Criteria

- `app_id` — matches the application's desktop ID (e.g., `"firefox"`, `"org.gnome.Nautilus"`)
- `title` — matches the window title exactly
- `window_type` — matches the Mutter window type as a numeric string

All fields are optional but at least one must be present. When multiple fields are specified, all must match (AND logic).

#### `window_type` values

| Value | Type | Description |
| ----- | ---- | ----------- |
| `"0"` | NORMAL | Regular application window |
| `"3"` | DIALOG | Dialog (transient child window) |
| `"4"` | MODAL_DIALOG | Modal dialog |
| `"7"` | UTILITY | Utility/tool window |
| `"8"` | SPLASHSCREEN | Splash screen |
| `"11"` | TOOLTIP | Tooltip |
| `"12"` | NOTIFICATION | Notification |
| `"15"` | OVERRIDE_OTHER | X11 override-redirect window (bypasses WM) |

Most rules should target `window_type: "0"` to avoid matching dialogs and popups that share the same `app_id` as the parent application. For example, a file-open dialog opened by `"org.gnome.Nautilus"` would otherwise match a rule that only specifies `app_id: "org.gnome.Nautilus"`.

```js
// Correct: targets only normal Nautilus windows, not its dialogs
{ match: { app_id: "org.gnome.Nautilus", window_type: "0" }, commands: ["floating enable"] }
```

### Finding app_id Values

Use the IPC debug command to see tracked windows and their IDs:

```bash
make ipc-debug
```

Look for the `wmClass` field in the output.

### Available Commands

Any Tessera command can be used in rules:

- `floating enable` / `floating disable` — float or tile a window
- `move container to workspace N` — send window to workspace N
- `move left/right/up/down` — re-parent window into the adjacent container
- `swap left/right/up/down` — swap window with the nearest window in that direction
- `fullscreen enable` — make window fullscreen
- `resize set W H` — set window size
- `retile` — recompute and reapply layout to all windows
- `alternating on` / `alternating off` / `alternating toggle` — control alternating mode on the focused split

## Workspace-Output Assignments

On multi-monitor setups, `workspaceOutputs` controls which workspaces appear on which monitor. The keys are workspace numbers (as strings), and values are monitor indices (0-based).

Workspaces not listed in the map are created on every monitor (the default GNOME behavior).

```js
module.exports = {
  // Workspaces 1-2 on primary monitor, workspace 3 on secondary
  workspaceOutputs: { "1": 0, "2": 0, "3": 1 },
};
```

## Startup Commands

The `exec` array runs commands when the extension is enabled. Commands are fire-and-forget (output is not captured). Use this to launch applications on login:

```js
module.exports = {
  exec: ["alacritty", "firefox", "nautilus"],
};
```

## Runtime Reload

Press `Super+Shift+R` (default binding) or run the `reload` command via IPC to reload the config file. This re-reads `~/.config/tessera/config.js`, applies all settings, and reloads keybindings. A notification is shown when the reload completes.

```bash
bunx tsx scripts/ipc-run.ts execute "reload"
```

Note: `exec` commands only run on initial enable, not on reload.

## Debug Snapshots

Press `Super+Shift+D` or `Super+Shift+I` to write a timestamped JSON snapshot of the current debug info or container tree to a log file:

| Binding | File |
| ------- | ---- |
| `Super+Shift+D` | `~/.local/state/tessera/debug.log` |
| `Super+Shift+I` | `~/.local/state/tessera/tree.log` |

Each keypress appends one line in the format:

```
[2026-02-19T12:34:56.789Z] { ...json payload... }
```

The same snapshots can be triggered via IPC:

```bash
bunx tsx scripts/ipc-run.ts execute "dump debug"
bunx tsx scripts/ipc-run.ts execute "dump tree"
```

## Retile

Press `Super+Shift+T` (default binding) or run the `retile` command via IPC to recompute and reapply the tiling layout to all windows. Useful if windows have drifted out of position (e.g. after connecting a monitor or waking from suspend).

```bash
bunx tsx scripts/ipc-run.ts execute "retile"
```
