import type { CommandHandler, CommandResult } from "../types.js";
import type { CommandContext } from "../context.js";
import { Container, Layout } from "../../tree/container.js";
import { WindowContainer } from "../../tree/window-container.js";
import { reflow } from "../../tree/reflow.js";
import { applyLayout } from "../../tree/apply-layout.js";

const result = (success: boolean, message?: string): CommandResult => ({
  success,
  message,
});

const getFocused = (context: CommandContext) => context.focused;

export const focusHandler: CommandHandler = {
  action: "focus",
  execute: (_command, context) => {
    const focused = getFocused(context);
    if (!focused) {
      return result(false, "No focused container");
    }

    focused.focused = true;
    if (focused instanceof WindowContainer) {
      context.adapter.activate(focused.window);
    }

    return result(true);
  },
};

export const moveHandler: CommandHandler = {
  action: "move",
  execute: (command, context) => {
    const focused = getFocused(context);
    if (!focused || !focused.parent) {
      return result(false, "No focused container to move");
    }

    const direction = command.args[0];
    const parent = focused.parent;
    const index = parent.children.indexOf(focused);
    if (index === -1) {
      return result(false, "Focused container not in parent");
    }

    const swapWith =
      direction === "left" || direction === "up" ? index - 1 : index + 1;

    if (swapWith < 0 || swapWith >= parent.children.length) {
      return result(true);
    }

    const temp = parent.children[swapWith];
    parent.children[swapWith] = focused;
    parent.children[index] = temp;

    reflow(parent);
    applyLayout(parent, context.adapter);

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

    reflow(focused.parent);
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

    reflow(focused.parent);
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
    };

    const layout = layoutMap[target];
    if (layout === undefined) {
      return result(false, "Unknown layout");
    }

    focused.parent.setLayout(layout);

    reflow(focused.parent);
    applyLayout(focused.parent, context.adapter);

    return result(true);
  },
};
