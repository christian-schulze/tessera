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

## Full Reference

```js
module.exports = {
  // Minimum window dimensions before a window is auto-floated.
  minTileWidth: 300,    // default: 300
  minTileHeight: 240,   // default: 240

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
    { match: { app_id: "firefox" }, commands: ["move container to workspace 2"] },
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
| `Super+Shift+H/J/K/L` | Move window left/down/up/right |
| `Super+B` | Split horizontal |
| `Super+V` | Split vertical |
| `Super+E` | Toggle split layout |
| `Super+F` | Toggle fullscreen |
| `Super+Shift+Q` | Close focused window |
| `Super+Shift+R` | Reload config |
| `Super+Shift+T` | Retile (reapply layout to all windows) |
| `Super+R` | Enter resize mode |
| `Super+1`..`9` | Switch to workspace 1-9 |
| `Super+0` | Switch to workspace 10 |
| `Super+Shift+1`..`9` | Move window to workspace 1-9 |
| `Super+Shift+0` | Move window to workspace 10 |

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

Both fields are optional but at least one must be present. When both are specified, both must match.

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
- `fullscreen enable` — make window fullscreen
- `resize set W H` — set window size
- `retile` — recompute and reapply layout to all windows

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

## Retile

Press `Super+Shift+T` (default binding) or run the `retile` command via IPC to recompute and reapply the tiling layout to all windows. Useful if windows have drifted out of position (e.g. after connecting a monitor or waking from suspend).

```bash
bunx tsx scripts/ipc-run.ts execute "retile"
```
