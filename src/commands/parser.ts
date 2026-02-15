import { Command, CommandCriteria, CriteriaOperator } from "./types.ts";

const criteriaOperatorRegex = /(.*?)(!=|=)(.*)/;

const tokenize = (input: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && /|\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
};

const parseCriteriaToken = (token: string): CommandCriteria => {
  const match = criteriaOperatorRegex.exec(token);
  if (!match) {
    return {
      key: token,
      operator: "exists",
      value: null,
    };
  }

  const [, key, operator, value] = match;
  return {
    key,
    operator: operator as CriteriaOperator,
    value,
  };
};

const parseCriteria = (criteriaBlock: string): CommandCriteria[] => {
  const trimmed = criteriaBlock.trim();
  if (!trimmed) {
    return [];
  }

  return tokenize(trimmed).map(parseCriteriaToken);
};

const extractCriteriaBlocks = (segment: string): {
  criteria: CommandCriteria[];
  command: string;
} => {
  const criteria: CommandCriteria[] = [];
  let remainder = segment;

  const criteriaRegex = /\[(.*?)\]/g;
  let match: RegExpExecArray | null;
  while ((match = criteriaRegex.exec(segment)) !== null) {
    criteria.push(...parseCriteria(match[1]));
  }

  remainder = remainder.replace(criteriaRegex, " ").trim();
  return { criteria, command: remainder };
};

export const parseCommandString = (input: string): Command[] => {
  return input
    .split(";")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const { criteria, command } = extractCriteriaBlocks(segment);
      const tokens = tokenize(command);
      const action = tokens[0] ?? "";
      const args = tokens.slice(1);

      return {
        raw: segment,
        action,
        args,
        criteria,
      };
    });
};
