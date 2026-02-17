# Decisions

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
