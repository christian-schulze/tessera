import type { Command, CommandHandler, CommandResult } from "./types.js";
import type { CommandContext } from "./context.js";

export class CommandEngine {
  private handlers: Map<string, CommandHandler> = new Map();

  register(handler: CommandHandler): void {
    this.handlers.set(handler.action, handler);
  }

  execute(command: Command, context: CommandContext): CommandResult {
    const handler = this.handlers.get(command.action);
    if (!handler) {
      return {
        success: false,
        message: `Unknown command: ${command.action}`,
      };
    }

    return handler.execute(command, context);
  }

  executeBatch(commands: Command[], context: CommandContext): CommandResult[] {
    return commands.map((command) => this.execute(command, context));
  }
}
