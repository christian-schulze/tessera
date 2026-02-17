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
