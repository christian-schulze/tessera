import type { CommandHandler, CommandResult } from "../types.js";
import type { CommandContext } from "../context.js";
import { Container, ContainerType, Layout } from "../../tree/container.js";
import { SplitContainer } from "../../tree/split-container.js";
import { WorkspaceContainer } from "../../tree/workspace-container.js";
import { WindowContainer } from "../../tree/window-container.js";
import { applyLayout } from "../../tree/apply-layout.js";
import { setFocusedContainer } from "../../tree/focus.js";
import { normalizeTree, reflow } from "../../tree/reflow.js";

const result = (success: boolean, message?: string): CommandResult => ({
  success,
  message,
});

const getFocused = (context: CommandContext) => context.focused;

const findFirstWindow = (container: Container): WindowContainer | null => {
  if (container instanceof WindowContainer) {
    return container;
  }

  for (const child of container.children) {
    const match = findFirstWindow(child);
    if (match) {
      return match;
    }
  }

  return null;
};

const findWorkspaceForContainer = (container: Container): WorkspaceContainer | null => {
  let current: Container | null = container;
  while (current) {
    if (current instanceof WorkspaceContainer) {
      return current;
    }
    current = current.parent;
  }
  return null;
};

const findWorkspaceByNumber = (root: Container, number: number): WorkspaceContainer | null => {
  const outputs = root.children.filter(
    (child): child is Container => child.type === ContainerType.Output
  );
  for (const output of outputs) {
    for (const child of output.children) {
      if (child instanceof WorkspaceContainer && child.number === number) {
        return child;
      }
    }
  }
  return null;
};

const findSplitTarget = (workspace: WorkspaceContainer): SplitContainer => {
  const existing = workspace.children.find(
    (child) => child.type === ContainerType.Split
  ) as SplitContainer | undefined;

  if (existing) {
    return existing;
  }

  const split = new SplitContainer(
    workspace.id * 100 + workspace.children.length + 1,
    Layout.Alternating
  );
  split.rect = { ...workspace.rect };
  workspace.addChild(split);
  return split;
};

const collectWindows = (container: Container): WindowContainer[] => {
  const windows: WindowContainer[] = [];

  const walk = (node: Container): void => {
    if (node instanceof WindowContainer) {
      windows.push(node);
      return;
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(container);
  return windows;
};

const getCenter = (window: WindowContainer): { x: number; y: number } => ({
  x: window.rect.x + window.rect.width / 2,
  y: window.rect.y + window.rect.height / 2,
});

const overlapSize = (
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number => Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));

const findDirectionalWindow = (
  root: Container,
  current: WindowContainer,
  direction: string
): WindowContainer | null => {
  const currentCenter = getCenter(current);
  const candidates = collectWindows(root).filter((window) => window !== current);

  const isCandidate = (window: WindowContainer): boolean => {
    const center = getCenter(window);
    switch (direction) {
      case "left":
        return center.x < currentCenter.x;
      case "right":
        return center.x > currentCenter.x;
      case "up":
        return center.y < currentCenter.y;
      case "down":
        return center.y > currentCenter.y;
      default:
        return false;
    }
  };

  const primaryDistance = (window: WindowContainer): number => {
    const center = getCenter(window);
    switch (direction) {
      case "left":
      case "right":
        return Math.abs(center.x - currentCenter.x);
      case "up":
      case "down":
        return Math.abs(center.y - currentCenter.y);
      default:
        return Number.POSITIVE_INFINITY;
    }
  };

  const secondaryDistance = (window: WindowContainer): number => {
    const center = getCenter(window);
    switch (direction) {
      case "left":
      case "right":
        return Math.abs(center.y - currentCenter.y);
      case "up":
      case "down":
        return Math.abs(center.x - currentCenter.x);
      default:
        return Number.POSITIVE_INFINITY;
    }
  };

  const matches = candidates.filter(isCandidate);
  if (matches.length === 0) {
    return null;
  }

  const overlapsAxis = (window: WindowContainer): boolean => {
    if (direction === "left" || direction === "right") {
      return (
        overlapSize(
          window.rect.y,
          window.rect.y + window.rect.height,
          current.rect.y,
          current.rect.y + current.rect.height
        ) > 0
      );
    }

    if (direction === "up" || direction === "down") {
      return (
        overlapSize(
          window.rect.x,
          window.rect.x + window.rect.width,
          current.rect.x,
          current.rect.x + current.rect.width
        ) > 0
      );
    }

    return false;
  };

  const preferred = matches.filter(overlapsAxis);
  if (preferred.length === 0) {
    return null;
  }
  const ranked = preferred;

  return ranked.reduce((best, candidate) => {
    const primary = primaryDistance(candidate);
    const bestPrimary = primaryDistance(best);
    if (primary !== bestPrimary) {
      return primary < bestPrimary ? candidate : best;
    }

    const secondary = secondaryDistance(candidate);
    const bestSecondary = secondaryDistance(best);
    if (secondary !== bestSecondary) {
      return secondary < bestSecondary ? candidate : best;
    }

    if (direction === "left" || direction === "right") {
      if (candidate.rect.y !== best.rect.y) {
        return candidate.rect.y < best.rect.y ? candidate : best;
      }
    }

    if (direction === "up" || direction === "down") {
      if (candidate.rect.x !== best.rect.x) {
        return candidate.rect.x < best.rect.x ? candidate : best;
      }
    }

    return candidate.id < best.id ? candidate : best;
  });
};


export const modeHandler: CommandHandler = {
  action: "mode",
  execute: (command, context) => {
    const target = command.args.join(" ").trim();
    if (!target) {
      return result(false, "Mode name required");
    }

    if (!context.switchMode) {
      return result(false, "Mode switching is unavailable");
    }

    const cleanName = target.replace(/^"|"$/g, "");
    const switched = context.switchMode(cleanName);
    if (!switched) {
      return result(false, `Unknown mode: ${cleanName}`);
    }

    return result(true);
  },
};

export const focusHandler: CommandHandler = {
  action: "focus",
  execute: (_command, context) => {
    const focused = getFocused(context);
    if (!focused) {
      return result(false, "No focused container");
    }

    const direction = _command.args[0];
    const currentWindow = focused instanceof WindowContainer
      ? focused
      : findFirstWindow(focused);
    if (!currentWindow) {
      return result(false, "No focused window");
    }

    let targetWindow = currentWindow;
    if (direction) {
      const currentWorkspace = findWorkspaceForContainer(currentWindow);
      targetWindow =
        findDirectionalWindow(currentWorkspace ?? context.root, currentWindow, direction) ?? currentWindow;
    }

    if (targetWindow) {
      setFocusedContainer(context.root, targetWindow);
      context.adapter.activate(targetWindow.window);
    } else {
      setFocusedContainer(context.root, null);
    }

    return result(true);
  },
};

export const moveHandler: CommandHandler = {
  action: "move",
  execute: (command, context) => {
    const focused = getFocused(context);
    if (!focused) {
      return result(false, "No focused container to move");
    }

    const [first, second, third, fourth] = command.args;
    if (first === "container" && second === "to" && third === "workspace") {
      const target = fourth;
      if (!target) {
        return result(false, "Workspace target required");
      }
      const index = Number.parseInt(target, 10);
      if (Number.isNaN(index) || index <= 0) {
        return result(false, "Workspace target must be a positive number");
      }
      if (!context.adapter.moveToWorkspace) {
        return result(false, "Move to workspace is unavailable");
      }
      const sourceWindow = focused instanceof WindowContainer
        ? focused
        : findFirstWindow(focused);
      if (!sourceWindow) {
        return result(false, "No focused window");
      }
      const currentWorkspace = findWorkspaceForContainer(sourceWindow);
      const targetWorkspace = findWorkspaceByNumber(context.root, index);

      if (targetWorkspace) {
        const sourceParent = sourceWindow.parent;
        if (sourceParent) {
          sourceParent.removeChild(sourceWindow);
          normalizeTree(sourceParent);
          let reflowRoot = sourceParent;
          if (reflowRoot.parent && reflowRoot.parent.type !== ContainerType.Workspace) {
            reflowRoot = reflowRoot.parent;
          }
          reflow(reflowRoot, context.config.gaps);
          applyLayout(reflowRoot, context.adapter);
        }

        if (sourceWindow.floating) {
          currentWorkspace?.removeFloatingWindow(sourceWindow);
        }

        const split = findSplitTarget(targetWorkspace);
        split.addChild(sourceWindow);
        if (sourceWindow.floating) {
          targetWorkspace.addFloatingWindow(sourceWindow);
        }
        reflow(split, context.config.gaps);
        applyLayout(split, context.adapter);
        setFocusedContainer(context.root, sourceWindow);
        targetWorkspace.lastFocusedWindowId = sourceWindow.windowId;
      }

      context.adapter.moveToWorkspace(sourceWindow.window, index - 1, true);
      context.adapter.activate(sourceWindow.window);
      return result(true);
    }

    if (!focused.parent) {
      return result(false, "No focused container to move");
    }

    const direction = first;
    if (!direction) {
      return result(false, "Move direction required");
    }

    const sourceWindow = focused instanceof WindowContainer
      ? focused
      : findFirstWindow(focused);
    if (!sourceWindow) {
      return result(false, "No focused window");
    }

    const currentWorkspace = findWorkspaceForContainer(sourceWindow);
    const targetWindow = findDirectionalWindow(currentWorkspace ?? context.root, sourceWindow, direction);
    if (!targetWindow) {
      return result(true);
    }

    const sourceParent = sourceWindow.parent;
    const targetParent = targetWindow.parent;
    if (!sourceParent || !targetParent) {
      return result(true);
    }

    const sourceIndex = sourceParent.children.indexOf(sourceWindow);
    const targetIndex = targetParent.children.indexOf(targetWindow);
    if (sourceIndex === -1 || targetIndex === -1) {
      return result(false, "Focused container not in parent");
    }

    sourceParent.children.splice(sourceIndex, 1, targetWindow);
    targetParent.children.splice(targetIndex, 1, sourceWindow);
    sourceWindow.parent = targetParent;
    targetWindow.parent = sourceParent;

    normalizeTree(sourceParent);
    if (targetParent !== sourceParent) {
      normalizeTree(targetParent);
    }

    let reflowRoot = sourceParent;
    if (reflowRoot.parent && reflowRoot.parent.type !== ContainerType.Workspace) {
      reflowRoot = reflowRoot.parent;
    }
    if (targetParent.parent && targetParent.parent.type !== ContainerType.Workspace) {
      reflowRoot = targetParent.parent;
    }

    reflow(reflowRoot, context.config.gaps);
    applyLayout(reflowRoot, context.adapter);

    return result(true);
  },
};

export const resizeHandler: CommandHandler = {
  action: "resize",
  execute: (command, context) => {
    const focused = getFocused(context);
    if (!focused) {
      return result(false, "No focused container to resize");
    }

    if (!focused.parent) {
      return result(false, "No parent container to resize");
    }

    const mode = command.args[0];
    const axisToken = command.args[1];
    const hasAxis = axisToken === "width" || axisToken === "height";
    const axis = hasAxis
      ? axisToken
      : focused.parent.layout === Layout.SplitV
        ? "height"
        : "width";
    const amountRaw = hasAxis ? command.args[2] : command.args[1];
    const unitRaw = hasAxis ? command.args[3] : command.args[2];
    const unit = unitRaw ?? "px";
    const amount = Number.parseFloat(amountRaw ?? "0");
    if (Number.isNaN(amount)) {
      return result(false, "Invalid resize amount");
    }

    if (
      (focused.parent.layout === Layout.SplitH && axis === "height") ||
      (focused.parent.layout === Layout.SplitV && axis === "width")
    ) {
      return result(false, "Resize axis does not match layout");
    }

    const mainSize = axis === "width" ? focused.parent.rect.width : focused.parent.rect.height;
    if (mainSize <= 0) {
      return result(false, "Invalid parent size");
    }

    const siblings = focused.parent.children;
    const totalProportion = siblings.reduce((sum, child) => sum + child.proportion, 0) || 1;
    const currentSize = (focused.proportion / totalProportion) * mainSize;
    const deltaPixels = unit === "ppt" ? (amount / 100) * mainSize : amount;
    const nextSize =
      mode === "set"
        ? deltaPixels
        : mode === "shrink"
          ? currentSize - deltaPixels
          : currentSize + deltaPixels;

    const getMinSize = (child: Container) => {
      const baseMin =
        axis === "width"
          ? Math.max(1, context.config.minTileWidth)
          : Math.max(1, context.config.minTileHeight);
      if (!(child instanceof WindowContainer)) {
        return baseMin;
      }

      const window = child.window as unknown as {
        get_min_size?: () => [number, number];
      };
      const minSize = window.get_min_size?.();
      if (!minSize) {
        return baseMin;
      }

      const windowMin = axis === "width" ? minSize[0] : minSize[1];
      return Math.max(baseMin, windowMin || 0);
    };

    const minSize = getMinSize(focused);
    const siblingMinTotal = siblings
      .filter((child) => child !== focused)
      .reduce((sum, child) => sum + getMinSize(child), 0);
    const maxSize = Math.max(minSize, mainSize - siblingMinTotal);
    const clampedSize = Math.min(Math.max(nextSize, minSize), maxSize);

    const siblingsProportion = Math.max(totalProportion - focused.proportion, 0.1);
    const nextShare = clampedSize / mainSize;
    const nextProportion = (nextShare * siblingsProportion) / (1 - nextShare);

    focused.proportion = Math.max(0.1, nextProportion);

    reflow(focused.parent, context.config.gaps);
    applyLayout(focused.parent, context.adapter);

    return result(true);
  },
};

export const splitHandler: CommandHandler = {
  action: "split",
  execute: (command, context) => {
    const focused = getFocused(context);
    if (!focused || !focused.parent) {
      return result(false, "No focused container to split");
    }

    const value = command.action === "splitv" || command.args[0] === "v";
    focused.parent.setLayout(value ? Layout.SplitV : Layout.SplitH);

    reflow(focused.parent, context.config.gaps);
    applyLayout(focused.parent, context.adapter);

    return result(true);
  },
};

export const layoutHandler: CommandHandler = {
  action: "layout",
  execute: (command, context) => {
    const focused = getFocused(context);
    if (!focused || !focused.parent) {
      return result(false, "No focused container to layout");
    }

    const target = command.args[0];
    const layoutMap: Record<string, Layout> = {
      splitv: Layout.SplitV,
      splith: Layout.SplitH,
      stacking: Layout.Stacking,
      tabbed: Layout.Tabbed,
      alternating: Layout.Alternating,
    };

    const layout = layoutMap[target];
    if (layout === undefined) {
      return result(false, "Unknown layout");
    }

    focused.parent.setLayout(layout);

    reflow(focused.parent, context.config.gaps);
    applyLayout(focused.parent, context.adapter);

    return result(true);
  },
};

export const alternatingModeHandler: CommandHandler = {
  action: "alternating-mode",
  execute: (command, context) => {
    const mode = command.args[0];
    if (mode !== "focused" && mode !== "tail") {
      return result(false, "Unknown alternating mode");
    }
    context.config.alternatingMode = mode as "focused" | "tail";
    return result(true);
  },
};

export const retileHandler: CommandHandler = {
  action: "retile",
  execute: (_command, context) => {
    for (const output of context.root.children) {
      for (const workspace of output.children) {
        if (workspace instanceof WorkspaceContainer) {
          reflow(workspace, context.config.gaps);
          applyLayout(workspace, context.adapter);
        }
      }
    }
    return result(true);
  },
};
