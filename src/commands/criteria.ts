import type { CommandCriteria, CriteriaOperator } from "./types.ts";
import { Container } from "../tree/container.ts";
import { WindowContainer } from "../tree/window-container.ts";
import { WorkspaceContainer } from "../tree/workspace-container.ts";

const evaluateString = (
  value: string | null | undefined,
  operator: CriteriaOperator,
  expected: string | null
): boolean => {
  if (operator === "exists") {
    return value !== null && value !== undefined && value !== "";
  }

  if (expected === null) {
    return false;
  }

  if (operator === "=") {
    return value === expected;
  }

  return value !== expected;
};

const evaluateBoolean = (
  value: boolean,
  operator: CriteriaOperator,
  expected: string | null
): boolean => {
  if (operator === "exists") {
    return value;
  }

  if (expected === null) {
    return false;
  }

  const normalized = expected.toLowerCase();
  const desired = normalized === "true" || normalized === "1" || normalized === "yes";

  if (operator === "=") {
    return value === desired;
  }

  return value !== desired;
};

const matchesCriterion = (container: Container, criterion: CommandCriteria): boolean => {
  switch (criterion.key) {
    case "app_id":
      if (!(container instanceof WindowContainer)) {
        return false;
      }
      return evaluateString(container.appId, criterion.operator, criterion.value);
    case "title":
      if (!(container instanceof WindowContainer)) {
        return false;
      }
      return evaluateString(container.title, criterion.operator, criterion.value);
    case "workspace":
      if (!(container instanceof WorkspaceContainer)) {
        return false;
      }
      return evaluateString(container.name, criterion.operator, criterion.value);
    case "con_mark":
      if (criterion.operator === "exists") {
        return container.marks.size > 0;
      }

      if (criterion.value === null) {
        return false;
      }

      if (criterion.operator === "=") {
        return container.marks.has(criterion.value);
      }

      return !container.marks.has(criterion.value);
    case "con_id":
      return evaluateString(String(container.id), criterion.operator, criterion.value);
    case "floating":
      if (!(container instanceof WindowContainer)) {
        return false;
      }
      return evaluateBoolean(container.floating, criterion.operator, criterion.value);
    case "tiling":
      if (!(container instanceof WindowContainer)) {
        return false;
      }
      return evaluateBoolean(!container.floating, criterion.operator, criterion.value);
    case "urgent":
      if (!(container instanceof WorkspaceContainer)) {
        return false;
      }
      return evaluateBoolean(container.urgent, criterion.operator, criterion.value);
    default:
      return false;
  }
};

export const matchesCriteria = (
  container: Container,
  criteria: CommandCriteria[]
): boolean => {
  if (criteria.length === 0) {
    return true;
  }

  return criteria.every((criterion) => matchesCriterion(container, criterion));
};
