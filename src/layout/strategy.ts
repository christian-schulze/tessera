import type { Container, Rect } from "../tree/container.js";
import { ContainerType, Layout } from "../tree/container.js";
import type { RootContainer } from "../tree/root-container.js";
import type { WindowContainer } from "../tree/window-container.js";

export interface OverflowContext {
  minTileWidth?: number;
  minTileHeight?: number;
  gaps?: {
    inner?: number;
    outer?: number;
  };
}

export interface InsertionContext {
  root: RootContainer;
  parent: Container;
  focused: WindowContainer;
  mode: "focused" | "append" | "tail";
}

export interface InsertionPlan {
  container?: Container;
  wrapTarget?: Container;
  wrapLayout?: Layout;
}

export type WindowAddedHandler = (context: InsertionContext) => InsertionPlan | null;

export interface LayoutStrategy {
  id: Layout;
  computeRects: (container: Container) => void;
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

const computeSplitRects = (container: Container, isHorizontal: boolean): void => {
  const layoutChildren = layoutChildrenFor(container);
  if (layoutChildren.length === 0) {
    return;
  }

  const inner = overflowContext.gaps?.inner ?? 0;
  const outer = overflowContext.gaps?.outer ?? 0;

  const baseRect = {
    x: container.rect.x + outer,
    y: container.rect.y + outer,
    width: Math.max(0, container.rect.width - outer * 2),
    height: Math.max(0, container.rect.height - outer * 2),
  };

  const totalProportion = layoutChildren.reduce(
    (sum, child) => sum + child.proportion,
    0
  );
  const safeProportion = totalProportion > 0 ? totalProportion : 1;

  const mainSize = isHorizontal ? baseRect.width : baseRect.height;
  const totalGap = inner * (layoutChildren.length - 1);
  const available = Math.max(0, mainSize - totalGap);

  let used = 0;
  let offset = isHorizontal ? baseRect.x : baseRect.y;

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
        y: baseRect.y,
        width: size,
        height: baseRect.height,
      };
      offset += size + inner;
    } else {
      child.rect = {
        x: baseRect.x,
        y: offset,
        width: baseRect.width,
        height: size,
      };
      offset += size + inner;
    }
  });
};

const splitHStrategy: LayoutStrategy = {
  id: Layout.SplitH,
  computeRects: (container) => {
    computeSplitRects(container, true);
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
  computeRects: (container) => {
    computeSplitRects(container, false);
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

const alternatingStrategy: LayoutStrategy = {
  id: Layout.Alternating,
  computeRects: (container) => {
    computeSplitRects(container, true);
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
  onWindowAdded: (context) => {
    if (context.mode !== "focused" && context.mode !== "tail") {
      return null;
    }

    const targetParent = context.focused.parent;
    if (!targetParent || targetParent.type !== ContainerType.Split) {
      return null;
    }

    const wrapTarget =
      context.mode === "focused"
        ? context.focused
        : targetParent.children[targetParent.children.length - 1];

    if (!wrapTarget) {
      return null;
    }

    const wrapLayout =
      targetParent.layout === Layout.SplitH
        ? Layout.SplitV
        : Layout.SplitH;

    return {
      container: context.parent,
      wrapLayout,
      wrapTarget,
    };
  },
};

const fallbackStrategy: LayoutStrategy = {
  id: Layout.SplitV,
  computeRects: (container) => {
    computeSplitRects(container, false);
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

const layoutStrategies = new Map<Layout, LayoutStrategy>([
  [Layout.SplitH, splitHStrategy],
  [Layout.SplitV, splitVStrategy],
  [Layout.Alternating, alternatingStrategy],
]);

export const getLayoutStrategy = (layout: Layout): LayoutStrategy => {
  return layoutStrategies.get(layout) ?? fallbackStrategy;
};
