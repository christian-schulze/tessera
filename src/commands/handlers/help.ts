import type { CommandHandler } from "../types.js";

export const bindingHelpHandler: CommandHandler = {
  action: "binding-help",
  execute: (_command, context) => {
    context.toggleBindingHelp?.();
    return { success: true };
  },
};
