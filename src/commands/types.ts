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

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}
