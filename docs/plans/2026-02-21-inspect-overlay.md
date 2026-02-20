# Plan: Window Inspect Overlay (`Super+I`)

## Context

When debugging tiling layout issues or just understanding where a window sits in the tree, it's useful to see at a glance: the window's title, app ID, window type, floating/fullscreen state, geometry, parent container layout, workspace, and container IDs. This adds a `Super+I` keybinding that shows a transparent overlay panel over the focused window with all of this information. Pressing the key again or switching focus hides it.

---

## Implementation Plan

### New files

**`src/inspect-overlay.ts`**

`InspectOverlay` class using `St.BoxLayout` (vertical) + `St.Label` widgets added to `global.window_group`, following the same pattern as `src/focus-border.ts`.

- `constructor()` — creates the panel widget (hidden), adds to `global.window_group`
- `show(container: WindowContainer)` — populates labels from container data, positions at `(rect.x + 16, rect.y + 16)`, raises above siblings, shows panel
- `hide()` — hides panel
- `toggle(container: WindowContainer)` — show if hidden, hide if visible
- `destroy()` — destroys the panel actor

Data shown (in sections):

| Section | Fields |
|---------|--------|
| Window | Title, App ID, Type (human-readable), Floating, Fullscreen |
| Geometry | Rect (`x,y  width×height`), Proportion |
| Tree | Parent type + layout + sibling count, Workspace number + name |
| IDs | Container ID, Window ID, Marks (if any) |

Panel style: `background-color: rgba(0,0,0,0.75); border-radius: 6px; padding: 12px; min-width: 320px;`

**`src/commands/handlers/inspect.ts`**

```typescript
export const inspectHandler: CommandHandler = {
  action: "inspect",
  execute: (_command, context) => {
    context.toggleInspect?.();
    return { success: true };
  },
};
```

### Modified files

| File | Change |
|------|--------|
| `src/commands/context.ts` | Add `toggleInspect?: () => void` |
| `src/commands/service.ts` | Add `toggleInspect?` to `CommandServiceDeps`; pass to context |
| `src/commands/index.ts` | Import + `engine.register(inspectHandler)` |
| `src/bindings/defaults.ts` | Add `{ keys: ["<Super>i"], command: "inspect" }` |
| `src/extension.ts` | Create/destroy `InspectOverlay`; wire `toggleInspect` callback (reads focused `WindowContainer` from root, calls `toggle()`); call `hide()` on focus change |
| `docs/configuration.md` | Add `Super+I` row to default keybindings table |

### Dismiss behaviour

- **Toggle**: pressing `Super+I` again hides it (the `toggleInspect` callback calls `toggle()`)
- **Focus change**: `onFocusChanged` in extension.ts calls `this.inspectOverlay?.hide()`

---

## Verification

1. `bun run build` — no TypeScript errors
2. `bun run test` — all existing tests pass
3. `make install && make nested` — load extension in nested GNOME Shell
4. Press `Super+I` over a focused tiled window — overlay appears with correct data
5. Press `Super+I` again — overlay disappears
6. Focus a different window — overlay auto-hides
7. Press `Super+I` over a floating window — `Floating: yes` displayed
8. Verify `Super+Shift+I` (dump tree) still works independently
9. `make install` on real session; verify `disable()` leaves no stale actors
