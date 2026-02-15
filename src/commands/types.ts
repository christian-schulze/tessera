export type CriteriaOperator = "=" | "!=" | "exists";

export interface CommandCriteria {
  key: string;
  operator: CriteriaOperator;
  value: string | null;
}

export interface Command {
  raw: string;
  action: string;
  args: string[];
  criteria: CommandCriteria[];
}

import type { CommandContext } from "./context.js";

export interface CommandHandler {
  action: string;
  execute: (command: Command, context: CommandContext) => CommandResult;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}
