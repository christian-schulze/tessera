import type { Rect } from "./tree/container.js";
import { Layout } from "./tree/container.js";

export const shouldFloatOnAdd = (
  layout: Layout,
  workspaceRect: Rect,
  projectedCount: number,
  minTileWidth: number,
  minTileHeight: number
): boolean => {
  if (layout === Layout.SplitH) {
    return workspaceRect.width / projectedCount < minTileWidth;
  }

  if (layout === Layout.SplitV) {
    return workspaceRect.height / projectedCount < minTileHeight;
  }

  return false;
};

export const shouldFloatOnRetry = (
  layout: Layout,
  workspaceRect: Rect,
  tiledCount: number,
  minTileWidth: number,
  minTileHeight: number,
  actualRect: Rect
): boolean => {
  if (layout === Layout.SplitH) {
    const minWidth = Math.max(minTileWidth, actualRect.width);
    return workspaceRect.width / tiledCount < minWidth;
  }

  if (layout === Layout.SplitV) {
    const minHeight = Math.max(minTileHeight, actualRect.height);
    return workspaceRect.height / tiledCount < minHeight;
  }

  return false;
};
