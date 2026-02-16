import { Container, ContainerType } from "./container.js";
import type { WindowContainer } from "./window-container.js";
import { getLayoutStrategy, overflowContext } from "../layout/strategy.js";

export interface GapConfig {
  inner?: number;
  outer?: number;
}

export function reflow(container: Container, gaps?: GapConfig): void {
  const { children } = container;
  if (children.length === 0) {
    return;
  }

  const layoutChildren = children.filter((child) => {
    if (child.type !== ContainerType.Window) {
      return true;
    }
    return !(child as WindowContainer).floating;
  });

  if (layoutChildren.length === 0) {
    return;
  }

  overflowContext.gaps = gaps;
  const strategy = getLayoutStrategy(container.layout);
  strategy.computeRects(container);
  overflowContext.gaps = undefined;

  layoutChildren.forEach((child) => {
    reflow(child, gaps);
  });
}
