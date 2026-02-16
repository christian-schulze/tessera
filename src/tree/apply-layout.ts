import type { Container } from "./container.js";
import { ContainerType, Rect } from "./container.js";
import type { WindowContainer } from "./window-container.js";
import type { WindowAdapter } from "../commands/adapter.js";

const applyGeometry = (adapter: WindowAdapter, window: unknown, rect: Rect): void => {
  adapter.moveResize(window, rect);
};

export const applyLayout = (container: Container, adapter: WindowAdapter): void => {
  for (const child of container.children) {
    if (child.type === ContainerType.Window) {
      const windowContainer = child as WindowContainer;
      if (windowContainer.floating) {
        continue;
      }
      applyGeometry(adapter, windowContainer.window, child.rect);
    } else if (child.children.length > 0) {
      applyLayout(child, adapter);
    }
  }
};
