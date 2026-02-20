import type { CommandHandler } from "../types.js";

export const inspectHandler: CommandHandler = {
  action: "inspect",
  execute: (_command, context) => {
    context.toggleInspect?.();
    return { success: true };
  },
};
