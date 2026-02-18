# Tessera

Tessera is an i3-like tiling window manager for GNOME Shell.

## Requirements

- GNOME Shell 49
- Bun (for dev/test tooling)

## Build

```bash
bun install
bun run build
```

## Test

```bash
bun run test
```

## Install (local)

```bash
make build
make install
```

Enable the extension:

```bash
gnome-extensions enable tessera@tessera.dev
```

## Nested Shell Debugging

```bash
make nested
```

In another terminal:

```bash
TESSERA_IPC=1 make nested
```

Then use the IPC CLI:

```bash
bunx tsx scripts/ipc-run.ts tree
bunx tsx scripts/ipc-run.ts debug
bunx tsx scripts/ipc-run.ts execute "splitv; focus right"
bunx tsx scripts/ipc-run.ts config 300
```

Or use the Make targets:

```bash
make ipc-tree
make ipc-debug
```

These commands work from your normal shell as long as a Tessera IPC socket is active
(normal session or nested shell).

## Logs

Tessera writes logs to:

```
~/.local/state/tessera/tessera.log
```

Nested GNOME Shell session logs (from `make nested`) are appended to:

```
~/.local/state/tessera/nested-gnome-shell.log
```

Tail logs with:

```bash
make logs
make logs-nested
```

## Configuration

Create `~/.config/tessera/config.js` to customize Tessera:

```js
module.exports = {
  gaps: { inner: 8, outer: 4 },
  focusedBorder: { color: "#5294e2", width: 2 },
  rules: [
    { match: { app_id: "org.gnome.Nautilus" }, commands: ["floating enable"] },
  ],
  exec: ["alacritty"],
};
```

Reload at runtime with `Super+Shift+R` or via IPC:

```bash
bunx tsx scripts/ipc-run.ts execute "reload"
```

See [docs/configuration.md](docs/configuration.md) for the full reference, including custom keybindings, window rules, gaps, workspace-output assignments, and startup commands.

## Review Notes

This extension follows the GNOME Shell review guidelines:
- no deprecated modules (Lang, ByteArray, Mainloop)
- no GTK usage inside GNOME Shell
- enable/disable cleanly creates and tears down signals/objects
- no obfuscated or minified code

## License

GPL-2.0-or-later
