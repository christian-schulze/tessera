# Visual focus + inspect overlay follow-ups — small implementation plan

## Scope
Address two UX issues observed during sticky/floating testing:
1. Focus border from other windows can appear above overlapping floating windows.
2. Inspect overlay does not refresh while open when window flags are toggled.

## Goals
- Keep focus border visually tied to the true focused window and below overlapping floating content where appropriate.
- Keep inspect overlay content in sync with runtime state changes (floating/sticky/fullscreen) without requiring close/reopen.

## Files likely involved
- `src/focus-border.ts`
- `src/extension.ts`
- `src/inspect-overlay.ts`
- `src/commands/handlers/workspace.ts`
- `tests/unit/*` (new targeted tests as needed)

## Plan

### 1) Border layering fix
- Review current focus border actor parent and stacking strategy in `FocusBorder`.
- Ensure border actor stack position does not rise above floating windows from other containers.
- If needed, move border to a more appropriate group/layer and/or clamp z-order updates during focus changes.
- Validate focused tiled and focused floating windows both render correctly.

### 2) Live inspect overlay refresh
- Add a lightweight `refresh(container)` path in `InspectOverlay` that rebuilds content and keeps panel visible/positioned.
- Trigger refresh after state-changing handlers (`floating`, `sticky`, `fullscreen`) when the focused target matches the currently inspected window.
- Keep behavior no-op when overlay is hidden.

### 3) Tests
- Add/extend unit tests for:
  - focus border stacking behavior contract (or smallest testable abstraction around layer/stack calls),
  - inspect overlay refresh trigger logic from workspace handlers.
- Prefer targeted tests first, then run full suite.

## Verification
- Targeted tests for touched units.
- `make test`.
- Manual nested-shell check:
  1. Open tiled + floating windows with overlap; confirm border never appears above overlapping floating content incorrectly.
  2. Open inspect overlay and toggle `floating`, `sticky`, `fullscreen`; confirm displayed values update live.
