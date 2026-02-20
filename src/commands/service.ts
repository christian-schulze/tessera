import type { RootContainer } from "../tree/root-container.js";
import type { Container } from "../tree/container.js";
import type { CommandEngine } from "./engine.js";
import type { WindowAdapter } from "./adapter.js";
import type { CommandResult } from "./types.js";
import type { TesseraConfig } from "../config.js";
import { parseCommandString } from "./parser.js";
import { findFocusedContainer } from "./index.js";

export interface CommandServiceDeps {
  engine: CommandEngine;
  adapter: WindowAdapter;
  getRoot: () => RootContainer | null;
  getConfig: () => TesseraConfig;
  reloadConfig?: () => void;
  switchMode?: (name: string) => boolean;
  getFocused?: (root: RootContainer) => Container | null;
  logger?: (message: string) => void;
  onAfterExecute?: () => void;
  dumpDebug?: () => void;
  dumpTree?: () => void;
  toggleInspect?: () => void;
}

export interface CommandService {
  execute: (command: string) => CommandResult[];
  executeForTarget: (command: string, target: Container) => CommandResult[];
}

export function buildCommandService(deps: CommandServiceDeps): CommandService {
  const getFocused = deps.getFocused ?? findFocusedContainer;

  const executeBatch = (command: string, focused: Container | null) => {
    const root = deps.getRoot();
    if (!root) {
      return [{ success: false, message: "Root container is not ready" }];
    }

    const commands = parseCommandString(command);

    return deps.engine.executeBatch(commands, {
      root,
      focused,
      adapter: deps.adapter,
      config: deps.getConfig(),
      reloadConfig: deps.reloadConfig,
      switchMode: deps.switchMode,
      logger: deps.logger,
      dumpDebug: deps.dumpDebug,
      dumpTree: deps.dumpTree,
      toggleInspect: deps.toggleInspect,
    });
  };

  return {
    execute: (command: string) => {
      const root = deps.getRoot();
      if (!root) {
        return [{ success: false, message: "Root container is not ready" }];
      }

      const results = executeBatch(command, getFocused(root));
      deps.onAfterExecute?.();
      return results;
    },
    executeForTarget: (command: string, target: Container) => {
      const results = executeBatch(command, target);
      deps.onAfterExecute?.();
      return results;
    },
  };
}
