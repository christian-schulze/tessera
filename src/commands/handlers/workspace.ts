import type { CommandHandler, CommandResult } from "../types.js";
import type { CommandContext } from "../context.js";
import { Container, ContainerType } from "../../tree/container.js";
import { WindowContainer } from "../../tree/window-container.js";
import { WorkspaceContainer } from "../../tree/workspace-container.js";

const result = (success: boolean, message?: string): CommandResult => ({
  success,
  message,
});

const findWorkspaceByName = (
  root: CommandContext["root"],
  name: string
): WorkspaceContainer | null => {
  const asNumber = Number.parseInt(name, 10);
  const hasNumber = !Number.isNaN(asNumber);

  for (const output of root.children) {
    if (output.type !== ContainerType.Output) {
      continue;
    }

    for (const child of output.children) {
      if (!(child instanceof WorkspaceContainer)) {
        continue;
      }

      if (child.name === name || (hasNumber && child.number === asNumber)) {
        return child;
      }
    }
  }

  return null;
};

const findWorkspaceForContainer = (
  container: Container
): WorkspaceContainer | null => {
  let current: Container | null = container;
  while (current) {
    if (current instanceof WorkspaceContainer) {
      return current;
    }
    current = current.parent;
  }

  return null;
};

export const workspaceHandler: CommandHandler = {
  action: "workspace",
  execute: (command, context) => {
    const target = command.args[0];
    if (!target) {
      return result(false, "Workspace name required");
    }

    const workspace = findWorkspaceByName(context.root, target);
    if (!workspace) {
      return result(false, `Workspace not found: ${target}`);
    }

    for (const output of context.root.children) {
      if (output.type !== ContainerType.Output) {
        continue;
      }

      for (const child of output.children) {
        if (child instanceof WorkspaceContainer) {
          child.visible = false;
          child.focused = false;
        }
      }
    }

    workspace.visible = true;
    workspace.focused = true;
    context.focused = workspace;

    return result(true);
  },
};

export const markHandler: CommandHandler = {
  action: "mark",
  execute: (command, context) => {
    const focused = context.focused;
    const mark = command.args[0];
    if (!focused) {
      return result(false, "No focused container to mark");
    }

    if (!mark) {
      return result(false, "Mark name required");
    }

    focused.marks.add(mark);
    return result(true);
  },
};

export const unmarkHandler: CommandHandler = {
  action: "unmark",
  execute: (command, context) => {
    const focused = context.focused;
    const mark = command.args[0];
    if (!focused) {
      return result(false, "No focused container to unmark");
    }

    if (!mark) {
      return result(false, "Mark name required");
    }

    focused.marks.delete(mark);
    return result(true);
  },
};

export const floatingHandler: CommandHandler = {
  action: "floating",
  execute: (command, context) => {
    const focused = context.focused;
    if (!(focused instanceof WindowContainer)) {
      return result(false, "Focused container is not a window");
    }

    const mode = command.args[0] ?? "toggle";
    let floating = focused.floating;
    if (mode === "toggle") {
      floating = !focused.floating;
    } else if (mode === "enable") {
      floating = true;
    } else if (mode === "disable") {
      floating = false;
    }

    focused.floating = floating;
    context.adapter.setFloating(focused.window, floating);

    const workspace = findWorkspaceForContainer(focused);
    if (workspace) {
      workspace.removeFloatingWindow(focused.window);
      if (floating) {
        workspace.addFloatingWindow(focused.window);
      }
    }

    return result(true);
  },
};

export const fullscreenHandler: CommandHandler = {
  action: "fullscreen",
  execute: (command, context) => {
    const focused = context.focused;
    if (!(focused instanceof WindowContainer)) {
      return result(false, "Focused container is not a window");
    }

    const mode = command.args[0] ?? "toggle";
    let fullscreen = focused.fullscreen;
    if (mode === "toggle") {
      fullscreen = !focused.fullscreen;
    } else if (mode === "enable") {
      fullscreen = true;
    } else if (mode === "disable") {
      fullscreen = false;
    }

    focused.fullscreen = fullscreen;
    context.adapter.setFullscreen(focused.window, fullscreen);
    return result(true);
  },
};
