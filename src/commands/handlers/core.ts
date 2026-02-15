import type { CommandHandler, CommandResult } from "../types.js";
import type { CommandContext } from "../context.js";
import { Layout } from "../../tree/container.js";
import { WindowContainer } from "../../tree/window-container.js";

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

    const direction = command.args[0];
    const amountRaw = command.args[2] ?? command.args[1];
    const amount = Number.parseFloat(amountRaw ?? "0");
    if (Number.isNaN(amount)) {
      return result(false, "Invalid resize amount");
    }

    const delta = direction === "shrink" ? -amount : amount;
    focused.proportion = Math.max(0.1, focused.proportion + delta);

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
    return result(true);
  },
};
