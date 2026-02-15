import { CommandEngine } from "./engine.ts";
import type { CommandHandler } from "./types.ts";
import { focusHandler, layoutHandler, moveHandler, resizeHandler, splitHandler } from "./handlers/core.ts";
import {
  floatingHandler,
  fullscreenHandler,
  markHandler,
  unmarkHandler,
  workspaceHandler,
} from "./handlers/workspace.ts";
import { execHandler, killHandler } from "./handlers/process.ts";
import type { Container } from "../tree/container.ts";

const aliasHandler = (action: string, handler: CommandHandler): CommandHandler => ({
  action,
  execute: handler.execute,
});

export const buildCommandEngine = (): CommandEngine => new CommandEngine();

export const registerDefaultHandlers = (engine: CommandEngine): void => {
  engine.register(focusHandler);
  engine.register(moveHandler);
  engine.register(resizeHandler);
  engine.register(layoutHandler);
  engine.register(splitHandler);
  engine.register(aliasHandler("splitv", splitHandler));
  engine.register(aliasHandler("splith", splitHandler));
  engine.register(workspaceHandler);
  engine.register(markHandler);
  engine.register(unmarkHandler);
  engine.register(floatingHandler);
  engine.register(fullscreenHandler);
  engine.register(execHandler);
  engine.register(killHandler);
};

export const findFocusedContainer = (container: Container): Container | null => {
  if (container.focused) {
    return container;
  }

  for (const child of container.children) {
    const focused = findFocusedContainer(child);
    if (focused) {
      return focused;
    }
  }

  return null;
};
