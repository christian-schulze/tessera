import type { CommandHandler, CommandResult } from "../types.js";
import { WindowContainer } from "../../tree/window-container.js";

const result = (success: boolean, message?: string): CommandResult => ({
  success,
  message,
});

export const execHandler: CommandHandler = {
  action: "exec",
  execute: (command, context) => {
    const commandString = command.args.join(" ").trim();
    if (!commandString) {
      return result(false, "Command required");
    }

    context.adapter.exec(commandString);
    return result(true);
  },
};

export const execCaptureHandler: CommandHandler = {
  action: "exec-capture",
  execute: (command, context) => {
    const commandString = command.args.join(" ").trim();
    if (!commandString) {
      return result(false, "Command required");
    }

    if (!context.adapter.execCapture) {
      return result(false, "Exec capture is unavailable");
    }

    const pending = context.adapter.execCapture(commandString);
    return {
      success: true,
      data: pending,
    };
  },
};

export const killHandler: CommandHandler = {
  action: "kill",
  execute: (_command, context) => {
    const focused = context.focused;
    if (!(focused instanceof WindowContainer)) {
      return result(false, "Focused container is not a window");
    }

    context.adapter.close(focused.window);
    return result(true);
  },
};

export const reloadHandler: CommandHandler = {
  action: "reload",
  execute: (_command, context) => {
    if (!context.reloadConfig) {
      return result(false, "Reload is unavailable");
    }

    context.reloadConfig();
    return result(true);
  },
};

export const dumpHandler: CommandHandler = {
  action: "dump",
  execute: (command, context) => {
    const target = command.args[0];
    if (target === "debug") {
      if (!context.dumpDebug) {
        return result(false, "Dump debug is unavailable");
      }
      context.dumpDebug();
      return result(true);
    }
    if (target === "tree") {
      if (!context.dumpTree) {
        return result(false, "Dump tree is unavailable");
      }
      context.dumpTree();
      return result(true);
    }
    return result(false, "Usage: dump debug|tree");
  },
};
