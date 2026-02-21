import type { Container, Rect } from "../tree/container.js";
import { ContainerType, Layout } from "../tree/container.js";
import type { RootContainer } from "../tree/root-container.js";
import type { WindowContainer } from "../tree/window-container.js";
import type { GapsConfig } from "../config.js";

export interface OverflowContext {
  minTileWidth?: number;
  minTileHeight?: number;
}

export interface InsertionContext {
  root: RootContainer;
  parent: Container;
  focused: WindowContainer;
  mode: "focused" | "append" | "tail";
}

export interface RemovalContext {
  root: RootContainer;
  parent: Container;
  removed: Container;
}

export interface InsertionPlan {
  container?: Container;
  wrapTarget?: Container;
  wrapLayout?: Layout;
}

export type WindowAddedHandler = (context: InsertionContext) => InsertionPlan | null;

export interface LayoutStrategy {
  id: Layout;
  computeRects: (container: Container, gaps?: GapsConfig) => void;
  shouldFloatOnAdd: (
    workspaceRect: Rect,
    projectedCount: number,
    minTileWidth: number,
    minTileHeight: number
  ) => boolean;
  shouldFloatOnRetry: (
    workspaceRect: Rect,
    tiledCount: number,
    minTileWidth: number,
    minTileHeight: number,
    actualRect: Rect
  ) => boolean;
  onWindowAdded?: WindowAddedHandler;
  onWindowRemoved?: (context: RemovalContext) => { handled?: boolean } | null;
}

export const overflowContext: OverflowContext = {};

const layoutChildrenFor = (container: Container): Container[] => {
  return container.children.filter((child) => {
    if (child.type !== ContainerType.Window) {
      return true;
    }
    return !(child as WindowContainer).floating;
  });
};

const isDescendantOf = (ancestor: Container, node: Container): boolean => {
  let current: Container | null = node;

  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = current.parent;
  }

  return false;
};

const tailPlanFor = (parent: Container): Pick<InsertionPlan, "wrapTarget" | "wrapLayout"> | null => {
  if (parent.children.length === 0) {
    return null;
  }

  let current: Container = parent;
  let lastSplitLayout: Layout | null = null;

  while (current.children.length > 0) {
    if (current.type === ContainerType.Split) {
      if (current.layout === Layout.SplitH || current.layout === Layout.SplitV) {
        lastSplitLayout = current.layout;
      }
    }

    current = current.children[current.children.length - 1];
  }

  if (!lastSplitLayout) {
    return null;
  }

  const wrapLayout =
    lastSplitLayout === Layout.SplitH ? Layout.SplitV : Layout.SplitH;

  return { wrapTarget: current, wrapLayout };
};

const computeSplitRects = (container: Container, isHorizontal: boolean, gaps?: GapsConfig): void => {
  const layoutChildren = layoutChildrenFor(container);
  if (layoutChildren.length === 0) {
    return;
  }

  const outerPad = container.parent?.type === ContainerType.Workspace ? (gaps?.outer ?? 0) : 0;
  const innerGap = gaps?.inner ?? 0;
  const n = layoutChildren.length;

  const baseX = container.rect.x + outerPad;
  const baseY = container.rect.y + outerPad;
  const baseWidth = container.rect.width - 2 * outerPad;
  const baseHeight = container.rect.height - 2 * outerPad;

  const totalProportion = layoutChildren.reduce(
    (sum, child) => sum + child.proportion,
    0
  );
  const safeProportion = totalProportion > 0 ? totalProportion : 1;

  const mainSize = isHorizontal ? baseWidth : baseHeight;
  const available = Math.max(0, mainSize - innerGap * (n - 1));

  let used = 0;
  let offset = isHorizontal ? baseX : baseY;

  layoutChildren.forEach((child, index) => {
    const isLast = index === layoutChildren.length - 1;
    let size = 0;

    if (isLast) {
      size = available - used;
    } else {
      size = Math.round((child.proportion / safeProportion) * available);
      used += size;
    }

    if (isHorizontal) {
      child.rect = {
        x: offset,
        y: baseY,
        width: size,
        height: baseHeight,
      };
      offset += size + innerGap;
    } else {
      child.rect = {
        x: baseX,
        y: offset,
        width: baseWidth,
        height: size,
      };
      offset += size + innerGap;
    }
  });
};

const splitHStrategy: LayoutStrategy = {
  id: Layout.SplitH,
  computeRects: (container, gaps) => {
    computeSplitRects(container, true, gaps);
  },
  shouldFloatOnAdd: (workspaceRect, projectedCount, minTileWidth) => {
    return workspaceRect.width / projectedCount < minTileWidth;
  },
  shouldFloatOnRetry: (
    workspaceRect,
    tiledCount,
    minTileWidth,
    _minTileHeight,
    actualRect
  ) => {
    const minWidth = Math.max(minTileWidth, actualRect.width);
    return workspaceRect.width / tiledCount < minWidth;
  },
};

const splitVStrategy: LayoutStrategy = {
  id: Layout.SplitV,
  computeRects: (container, gaps) => {
    computeSplitRects(container, false, gaps);
  },
  shouldFloatOnAdd: (
    workspaceRect,
    projectedCount,
    _minTileWidth,
    minTileHeight
  ) => {
    return workspaceRect.height / projectedCount < minTileHeight;
  },
  shouldFloatOnRetry: (
    workspaceRect,
    tiledCount,
    _minTileWidth,
    minTileHeight,
    actualRect
  ) => {
    const minHeight = Math.max(minTileHeight, actualRect.height);
    return workspaceRect.height / tiledCount < minHeight;
  },
};

const fallbackStrategy: LayoutStrategy = {
  id: Layout.SplitV,
  computeRects: (container, gaps) => {
    computeSplitRects(container, false, gaps);
  },
  shouldFloatOnAdd: (
    workspaceRect,
    projectedCount,
    _minTileWidth,
    minTileHeight
  ) => {
    return workspaceRect.height / projectedCount < minTileHeight;
  },
  shouldFloatOnRetry: (
    workspaceRect,
    tiledCount,
    _minTileWidth,
    minTileHeight,
    actualRect
  ) => {
    const minHeight = Math.max(minTileHeight, actualRect.height);
    return workspaceRect.height / tiledCount < minHeight;
  },
};

const makeAlternatingWindowAddedHandler = (): WindowAddedHandler => {
  return (context) => {
    if (context.mode !== "focused" && context.mode !== "tail") {
      return null;
    }

    const tiledChildren = layoutChildrenFor(context.parent);
    // With 0 or 1 child, append the new window directly alongside the existing one
    // rather than wrapping in a nested split. Wrapping only makes sense from 3rd+.
    if (tiledChildren.length <= 1) {
      return null;
    }

    if (context.mode === "focused" && !isDescendantOf(context.parent, context.focused)) {
      const tailPlan = tailPlanFor(context.parent);
      if (!tailPlan) {
        const wrapLayout =
          context.parent.layout === Layout.SplitH ? Layout.SplitV : Layout.SplitH;
        return {
          container: context.parent,
          wrapLayout,
          wrapTarget: tiledChildren[tiledChildren.length - 1],
        };
      }

      return {
        container: context.parent,
        wrapLayout: tailPlan.wrapLayout,
        wrapTarget: tailPlan.wrapTarget,
      };
    }

    if (context.mode === "tail") {
      const tailPlan = tailPlanFor(context.parent);
      if (!tailPlan) {
        const wrapLayout =
          context.parent.layout === Layout.SplitH ? Layout.SplitV : Layout.SplitH;
        return {
          container: context.parent,
          wrapLayout,
          wrapTarget: tiledChildren[tiledChildren.length - 1],
        };
      }

      return {
        container: context.parent,
        wrapLayout: tailPlan.wrapLayout,
        wrapTarget: tailPlan.wrapTarget,
      };
    }

    const targetParent = context.focused.parent;
    if (!targetParent || targetParent.type !== ContainerType.Split) {
      return null;
    }

    const wrapLayout =
      targetParent.layout === Layout.SplitH ? Layout.SplitV : Layout.SplitH;

    return {
      container: context.parent,
      wrapLayout,
      wrapTarget: context.focused,
    };
  };
};

const layoutStrategies = new Map<Layout, LayoutStrategy>([
  [Layout.SplitH, splitHStrategy],
  [Layout.SplitV, splitVStrategy],
]);

export const getLayoutStrategy = (container: Container): LayoutStrategy => {
  const base = layoutStrategies.get(container.layout) ?? fallbackStrategy;
  if (container.alternating) {
    return { ...base, onWindowAdded: makeAlternatingWindowAddedHandler() };
  }
  return base;
};
