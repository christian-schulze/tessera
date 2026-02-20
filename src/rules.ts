import type { ForWindowRule } from "./config.js";
import type { CommandCriteria } from "./commands/types.js";
import { matchesCriteria } from "./commands/criteria.js";
import type { WindowContainer } from "./tree/window-container.js";

const ruleToCriteria = (match: ForWindowRule["match"]): CommandCriteria[] => {
  const criteria: CommandCriteria[] = [];

  if (match.app_id) {
    criteria.push({ key: "app_id", operator: "=", value: match.app_id });
  }

  if (match.title) {
    criteria.push({ key: "title", operator: "=", value: match.title });
  }

  if (match.window_type !== undefined) {
    criteria.push({ key: "window_type", operator: "=", value: match.window_type });
  }

  return criteria;
};

export const evaluateRules = (
  rules: ForWindowRule[],
  container: WindowContainer
): string[] => {
  const commands: string[] = [];

  for (const rule of rules) {
    const criteria = ruleToCriteria(rule.match);
    if (matchesCriteria(container, criteria)) {
      commands.push(...rule.commands);
    }
  }

  return commands;
};
