import type { RootContainer } from "../tree/root-container.js";
import type { Container } from "../tree/container.js";
import type { CommandEngine } from "./engine.js";
import type { WindowAdapter } from "./adapter.js";
import type { CommandResult } from "./types.js";
import type { TesseraConfig } from "../config.js";
import { parseCommandString } from "./parser.js";
import { findFocusedContainer } from "./index.js";

interface CommandServiceDeps {
  engine: CommandEngine;
  adapter: WindowAdapter;
  getRoot: () => RootContainer | null;
  getConfig: () => TesseraConfig;
  getFocused?: (root: RootContainer) => Container | null;
  logger?: (message: string) => void;
}

export interface CommandService {
  execute: (command: string) => CommandResult[];
}

export function buildCommandService(deps: CommandServiceDeps): CommandService {
  const getFocused = deps.getFocused ?? findFocusedContainer;

  return {
    execute: (command: string) => {
      const root = deps.getRoot();
      if (!root) {
        return [{ success: false, message: "Root container is not ready" }];
      }

      const commands = parseCommandString(command);
      const focused = getFocused(root);

      return deps.engine.executeBatch(commands, {
        root,
        focused,
        adapter: deps.adapter,
        config: deps.getConfig(),
        logger: deps.logger,
      });
    },
  };
}
