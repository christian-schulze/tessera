# Learnings

## Mutter move/resize user operation flag

When calling `Meta.Window.move_resize_frame(user_op, x, y, w, h)`, the
`user_op` boolean only marks the move/resize as a user action.

Key effects in Mutter (`src/core/window.c`):
- Sets `META_MOVE_RESIZE_USER_ACTION`, which adds
  `META_WINDOW_UPDATE_MONITOR_FLAGS_USER_OP` during monitor updates.
- If the window crosses monitors and the move is a user action,
  Mutter updates the window's preferred logical monitor.
- With "workspaces only on primary" enabled, a user action that moves a
  window back onto the primary monitor may force the window onto the
  active workspace to avoid disappearing when crossing monitor borders.

Important: `user_op` does not change the resize math or constraints. It
only affects monitor/workspace behavior when crossing monitors. This is
unlikely to explain size changes being ignored or overridden.

Source: https://gnome.pages.gitlab.gnome.org/mutter/meta/method.Window.move_resize_frame.html

Related code (Mutter):
- https://github.com/GNOME/mutter/blob/main/src/core/window.c
  - `meta_window_move_resize_frame`
  - `meta_window_move_resize`
  - `meta_window_update_monitor`

## When sizes are ignored or overridden (suspects)

- Client size hints (min/max size, aspect) clamping the requested frame.
- Resize races where a later configure overrides the requested size.
- Mutter constraints from work area/monitor changes (struts, workspaces,
  or preferred monitor updates).
- Extension/layout retry logic reapplying geometry after the client
  responds with a different frame.
