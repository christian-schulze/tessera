import type { Container } from "./container.ts";
import { ContainerType, Rect } from "./container.ts";
import type { WindowContainer } from "./window-container.ts";
import type { WindowAdapter } from "../commands/adapter.ts";

const applyGeometry = (adapter: WindowAdapter, window: unknown, rect: Rect): void => {
  adapter.moveResize(window, rect);
};

export const applyLayout = (container: Container, adapter: WindowAdapter): void => {
  for (const child of container.children) {
    if (child.type === ContainerType.Window) {
      const windowContainer = child as WindowContainer;
      applyGeometry(adapter, windowContainer.window, child.rect);
    } else if (child.children.length > 0) {
      applyLayout(child, adapter);
    }
  }
};
