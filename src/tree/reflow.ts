import { Container, Layout } from "./container.ts";

export interface GapConfig {
  inner?: number;
  outer?: number;
}

export function reflow(container: Container, gaps?: GapConfig): void {
  const { children } = container;
  if (children.length === 0) {
    return;
  }

  const inner = gaps?.inner ?? 0;
  const outer = gaps?.outer ?? 0;

  const baseRect = {
    x: container.rect.x + outer,
    y: container.rect.y + outer,
    width: Math.max(0, container.rect.width - outer * 2),
    height: Math.max(0, container.rect.height - outer * 2),
  };

  const totalProportion = children.reduce(
    (sum, child) => sum + child.proportion,
    0
  );
  const safeProportion = totalProportion > 0 ? totalProportion : 1;

  const isHorizontal = container.layout === Layout.SplitH;
  const mainSize = isHorizontal ? baseRect.width : baseRect.height;
  const totalGap = inner * (children.length - 1);
  const available = Math.max(0, mainSize - totalGap);

  let used = 0;
  let offset = isHorizontal ? baseRect.x : baseRect.y;

  children.forEach((child, index) => {
    const isLast = index === children.length - 1;
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

    reflow(child, gaps);
  });
}
