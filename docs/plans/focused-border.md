# Plan: Re-add Configurable Focused Window Border

## Context

`docs/configuration.md` documents a `focusedBorder` config option (color + width), but it was never implemented in the TypeScript source. `src/config.ts`'s `TesseraConfig` type and `applyConfig()` have no `focusedBorder` handling. The feature needs to be built from scratch.

The codebase currently has no visual overlay infrastructure — it only manipulates window geometry via `Meta.Window.move_resize_frame()`. St, Clutter, and Shell type definitions are already present in `package.json` devDependencies (`@girs/st-17`, `@girs/clutter-17`, `@girs/shell-17`).

---

## Available Approaches

### Option A: St.Widget overlay on `global.window_group` (4-bar border) — **Recommended**

Create 4 thin `St.Widget` rectangles (top/bottom/left/right) added to `global.window_group`, positioned to match the focused window's `get_frame_rect()`.

**How it works:**
- Each bar is an `St.Widget` with `background-color: <color>` and `reactive: false` (clicks pass through)
- Added to `global.window_group` so they composite with windows; z-order is set above window actors
- On focus change: reposition and show bars against new window's frame rect, or hide all if no focus
- Connect to the focused window actor's `allocation-changed` Clutter signal to track moves/resizes
- Disconnect old window signal when focus changes
- On `disable()`: destroy all 4 actors

**Pros:**
- Idiomatic GNOME Shell extension pattern (used widely by extensions like "Highlight Focus", "Window Highlighter")
- Full control over color and width via simple CSS style strings
- Wayland and X11 compatible
- Clean separation — doesn't touch window geometry at all
- CSS color strings work natively (hex, rgb(), named colors)
- `reactive: false` ensures no input interference

**Cons:**
- Must handle actor stacking manually (ensure bars render above windows)
- Bars need repositioning on window move/resize (requires connecting to window actor's `allocation-changed`)
- Bars can briefly lag behind fast window animations (1 frame)
- Need to handle workspace switches (hide when window is on inactive workspace)

---

### Option B: Single `St.Widget` with CSS border

A single full-frame `St.Widget` positioned behind or over the window with `border: Npx solid color` CSS.

**Pros:** Simpler code (one actor instead of four)

**Cons:**
- CSS `border` on a Clutter widget fills the interior background too unless carefully styled
- Positioning a single actor over window content means it occludes the window unless it's transparent inside — requires `background-color: transparent` which may not clip correctly with Clutter's rendering model
- Harder to get a sharp border without the background leaking through
- The 4-bar approach is actually more reliable in practice

---

### Option C: Apply style to `MetaWindowActor` directly

Get the `MetaWindowActor` via `global.get_window_actors()` and set a style or Clutter effect on it.

**Pros:** Border follows window automatically (no repositioning logic)

**Cons:**
- `MetaWindowActor` is a composite actor managed by Mutter — applying CSS or effects to it can break shadows, blurs, and compositing
- Unreliable across GNOME Shell versions; actor internals can change
- Can interfere with window transparency and fullscreen detection
- **Not recommended for production extensions**

---

### Option D: Clutter.Canvas with Cairo drawing

Draw the border using Cairo on a `Clutter.Canvas`, attach to an actor over the window.

**Pros:** Maximum flexibility (dashed borders, gradients, rounded corners possible)

**Cons:**
- Significantly more complex than CSS-based approach
- No additional benefit for a simple solid-color border
- Cairo canvas invalidation needs manual management

---

## Implementation Plan (Option A)

### Files to create/modify

1. **`src/config.ts`**
   - Add `FocusedBorderConfig = { color: string; width: number }` type
   - Add `focusedBorder: FocusedBorderConfig` to `TesseraConfig`
   - Add `DEFAULT_CONFIG.focusedBorder = { color: "", width: 0 }` (disabled by default)
   - Add `normalizeFocusedBorder()` in `applyConfig()`
   - Border is active only when `color` is non-empty and `width > 0`

2. **`src/focus-border.ts`** (new file)
   - `FocusBorder` class managing 4 `St.Widget` bars
   - `constructor(color: string, width: number)` — creates actors, adds to `global.window_group`
   - `update(metaWindow: Meta.Window | null)` — positions bars to frame rect or hides
   - `destroy()` — removes actors, disconnects signals
   - Internally connects to focused window actor's `allocation-changed` to auto-reposition

3. **`src/extension.ts`**
   - Add `private focusBorder: FocusBorder | null = null` field
   - Create `FocusBorder` once in `enable()` if `config.focusedBorder.width > 0 && color`
   - Wire `onFocusChanged` callback in `WindowTracker` options to call `focusBorder.update()`
   - On config reload: destroy and recreate `FocusBorder` with new settings
   - In `disable()`: `this.focusBorder?.destroy(); this.focusBorder = null`

### Actor positioning logic

```
const rect = metaWindow.get_frame_rect();
// top bar
topBar.set_position(rect.x - width, rect.y - width);
topBar.set_size(rect.width + 2*width, width);
// bottom bar
bottomBar.set_position(rect.x - width, rect.y + rect.height);
bottomBar.set_size(rect.width + 2*width, width);
// left bar
leftBar.set_position(rect.x - width, rect.y);
leftBar.set_size(width, rect.height);
// right bar
rightBar.set_position(rect.x + rect.width, rect.y);
rightBar.set_size(width, rect.height);
```

### Window move/resize tracking

Connect to the focused `MetaWindowActor`'s Clutter `allocation-changed` signal:
```typescript
const actor = metaWindow.get_compositor_private() as Clutter.Actor;
this.windowSignalId = actor.connect('allocation-changed', () => this.reposition());
```
Disconnect from the old actor when focus changes.

---

## Verification

1. Build: `bun run build` (no TypeScript errors)
2. Install: `make install`
3. Test in nested GNOME Shell: `make nested`
4. Set config: `focusedBorder: { color: "#5294e2", width: 2 }` in `~/.config/tessera/config.js`
5. Verify border appears around focused window
6. Verify border moves/resizes with the window
7. Verify border hides when no window is focused
8. Verify border updates correctly on workspace switch
9. Verify `disable()` removes the border cleanly (no artifacts after extension reload)
10. Verify with `color: ""` or `width: 0` that border is not shown (disabled by default)
