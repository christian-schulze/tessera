import { Container, ContainerType, Layout } from "./container.js";
import type { WindowContainer } from "./window-container.js";
import { getLayoutStrategy } from "../layout/strategy.js";

export const findReflowRoot = (container: Container): Container => {
  let current: Container = container;
  while (current.parent && current.parent.type !== ContainerType.Workspace) {
    current = current.parent;
  }
  return current;
};

export function reflow(container: Container): void {
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

  const strategy = getLayoutStrategy(container.layout);
  strategy.computeRects(container);

  layoutChildren.forEach((child) => {
    reflow(child);
  });
}

export const normalizeTree = (start: Container): void => {
  let current: Container | null = start;

  while (current) {
    if (current.type === ContainerType.Split) {
      for (let index = current.children.length - 1; index >= 0; index -= 1) {
        const child = current.children[index];
        if (
          child.type === ContainerType.Split &&
          child.children.length === 0 &&
          child.layout !== Layout.Alternating
        ) {
          current.children.splice(index, 1);
          child.parent = null;
        }
      }

      const parent: Container | null = current.parent;
      const isWorkspaceChild = parent?.type === ContainerType.Workspace;
      const isAlternating = current.layout === Layout.Alternating;

      if (current.children.length === 0) {
        if (parent && !isWorkspaceChild && !isAlternating) {
          parent.removeChild(current);
          current = parent;
          continue;
        }
      } else if (current.children.length === 1) {
        if (parent && !isWorkspaceChild && !isAlternating) {
          const onlyChild = current.children[0];
          const index = parent.children.indexOf(current);
          if (index !== -1) {
            parent.children[index] = onlyChild;
            onlyChild.parent = parent;
            onlyChild.proportion = current.proportion;
            current.parent = null;
          }
          current = parent;
          continue;
        }
      }
    }

    current = current.parent;
  }
};
