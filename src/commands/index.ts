import { CommandEngine } from "./engine.js";
import type { CommandHandler } from "./types.js";
import {
  alternatingModeHandler,
  focusHandler,
  layoutHandler,
  modeHandler,
  moveHandler,
  resizeHandler,
  retileHandler,
  splitHandler,
} from "./handlers/core.js";
import {
  floatingHandler,
  fullscreenHandler,
  markHandler,
  unmarkHandler,
  workspaceHandler,
} from "./handlers/workspace.js";
import { dumpHandler, execCaptureHandler, execHandler, killHandler, reloadHandler } from "./handlers/process.js";
import { inspectHandler } from "./handlers/inspect.js";
import type { Container } from "../tree/container.js";

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
  engine.register(modeHandler);
  engine.register(splitHandler);
  engine.register(alternatingModeHandler);
  engine.register(retileHandler);
  engine.register(aliasHandler("splitv", splitHandler));
  engine.register(aliasHandler("splith", splitHandler));
  engine.register(workspaceHandler);
  engine.register(markHandler);
  engine.register(unmarkHandler);
  engine.register(floatingHandler);
  engine.register(fullscreenHandler);
  engine.register(execHandler);
  engine.register(execCaptureHandler);
  engine.register(killHandler);
  engine.register(reloadHandler);
  engine.register(dumpHandler);
  engine.register(inspectHandler);
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
