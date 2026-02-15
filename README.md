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
node scripts/ipc-run.js tree
node scripts/ipc-run.js execute "splitv; focus right"
```

## Review Notes

This extension follows the GNOME Shell review guidelines:
- no deprecated modules (Lang, ByteArray, Mainloop)
- no GTK usage inside GNOME Shell
- enable/disable cleanly creates and tears down signals/objects
- no obfuscated or minified code

## License

GPL-2.0-or-later
