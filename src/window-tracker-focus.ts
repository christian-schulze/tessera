import type Meta from "gi://Meta";
import type { Container } from "./tree/container.js";
import type { WindowContainer } from "./tree/window-container.js";
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
};
