# Decisions

## 2026-02-21 - Replace `Layout.Alternating` with an `alternating` flag on `Container`

The original implementation used a dedicated `Layout.Alternating` enum value for the workspace root split. This required:
- Special-casing in `normalizeTree` to prevent the root from being collapsed
- A dedicated `alternatingStrategy` object with a hardcoded `SplitH` fallback for the first wrap
- Guard logic in `tailPlanFor` (it couldn't see the alternating root as a valid SplitH/V node)

The refactor replaces this with an `alternating: boolean` field on every `Container`. The workspace root split is now `Layout.SplitH` with `alternating = true`. Key consequences:

- **`normalizeTree`** — the special case becomes `!child.alternating` and `current.alternating`, which reads clearly and works for any container, not just the workspace root.
- **`tailPlanFor`** — now naturally picks up the root on its first iteration (it is a real SplitH), so no skipping logic is needed.
- **First-wrap axis** — no longer hardcoded to `SplitH`. It is derived from `context.parent.layout`'s opposite, meaning a `SplitV`-first alternating container is now expressible.
- **`getLayoutStrategy`** — signature changed from `(layout: Layout)` to `(container: Container)`. The alternating `onWindowAdded` handler is overlaid on the base strategy when `container.alternating` is true.
- **`layout alternating` command removed** — the `Layout.Alternating` value no longer exists. Alternating is a flag, not a layout type.
- **New `alternating on|off|toggle` command** — controls the flag on the focused split at runtime. Default binding: `Super+Shift+E`.
- **New `defaultAlternating` config key** — controls whether new workspace root splits start with the flag set (default: `true` for backward compatibility).

The `alternatingMode` config key and `alternating-mode` command are unchanged; they continue to control focused-vs-tail insertion behavior.

## 2026-02-17 - Use non-user move/resize operations

We set `Meta.Window.move_resize_frame(user_op, x, y, w, h)` to use
`user_op = false` in Tessera.

Rationale:
- `user_op` only affects monitor/workspace behavior (e.g., preferred
  logical monitor updates and workspace reassignment when crossing
  monitors with "workspaces only on primary").
- It does not change resize geometry or constraints, so using
  `false` is more semantically correct for programmatic layout.

Locations:
- `src/extension.ts`
- `src/window-tracker.ts`

Reference:
- https://gnome.pages.gitlab.gnome.org/mutter/meta/method.Window.move_resize_frame.html
- https://github.com/GNOME/mutter/blob/main/src/core/window.c
