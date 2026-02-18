import type Meta from "gi://Meta";
import type { Container } from "./tree/container.js";
import type { WindowContainer } from "./tree/window-container.js";
import { WorkspaceContainer } from "./tree/workspace-container.js";
import { findWorkspaceByIndex, getWorkspaceIndexFromWindow } from "./window-workspace.js";
import { setFocusedContainer } from "./tree/focus.js";

const getWindowId = (window: Meta.Window): number => {
  if (typeof window.get_id === "function") {
    return window.get_id();
  }

  return window.get_stable_sequence();
};

export const updateFocusedWindow = (
  root: Container,
  windowMap: Map<number, WindowContainer>,
  focusedWindow: Meta.Window | null
): void => {
  if (!focusedWindow) {
    setFocusedContainer(root, null);
    return;
  }

  const windowId = getWindowId(focusedWindow);
  const container = windowMap.get(windowId) ?? null;
  setFocusedContainer(root, container);
  if (container) {
    const workspaceIndex = getWorkspaceIndexFromWindow(focusedWindow);
    let workspace: WorkspaceContainer | null = null;
    if (workspaceIndex !== null) {
      workspace = findWorkspaceByIndex(root, workspaceIndex);
    }
    if (!workspace) {
      let current: Container | null = container;
      while (current) {
        if (current instanceof WorkspaceContainer) {
          workspace = current;
          break;
        }
        current = current.parent;
      }
    }
    if (workspace) {
      workspace.lastFocusedWindowId = windowId;
    }
  }
};
