import type { CommandHandler, CommandResult } from "../types.js";
import type { CommandContext } from "../context.js";
import { Container, ContainerType } from "../../tree/container.js";
import { WindowContainer } from "../../tree/window-container.js";
import { WorkspaceContainer } from "../../tree/workspace-container.js";
import { reflow } from "../../tree/reflow.js";
import { appendLog } from "../../logging.js";
import { applyLayout } from "../../tree/apply-layout.js";
import { setFocusedContainer } from "../../tree/focus.js";

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

const collectWindows = (container: Container): WindowContainer[] => {
  const windows: WindowContainer[] = [];
  const walk = (node: Container): void => {
    if (node instanceof WindowContainer) {
      windows.push(node);
      return;
    }
    for (const child of node.children) {
      walk(child);
    }
  };
  walk(container);
  return windows;
};

const scheduleFocusRestore = (action: () => void): void => {
  if ((globalThis as { jasmine?: unknown }).jasmine) {
    action();
    return;
  }
  const gi = (globalThis as { imports?: { gi?: { GLib?: unknown } } }).imports?.gi;
  const GLib = gi?.GLib as
    | {
        PRIORITY_DEFAULT: number;
        SOURCE_REMOVE: boolean;
        idle_add: (priority: number, callback: () => boolean) => void;
      }
    | undefined;
  if (GLib?.idle_add) {
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
      action();
      return GLib.SOURCE_REMOVE;
    });
    return;
  }

  if (typeof globalThis.setTimeout === "function") {
    globalThis.setTimeout(action, 0);
    return;
  }

  action();
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

    appendLog(`workspace command: ${target} -> index=${workspace.number - 1}`);
    const rememberedFocusId = workspace.lastFocusedWindowId;
    if (!context.adapter.changeWorkspace) {
      return result(false, "Workspace switching is unavailable");
    }
    context.adapter.changeWorkspace(workspace.number - 1);

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

    const windows = collectWindows(workspace).filter((window) => !window.floating);
    const lastFocused = rememberedFocusId ?? workspace.lastFocusedWindowId;
    let focusTarget = lastFocused
      ? windows.find((window) => window.windowId === lastFocused)
      : null;
    if (!focusTarget) {
      focusTarget = windows[0] ?? null;
      if (focusTarget) {
        workspace.lastFocusedWindowId = focusTarget.windowId;
      }
    }

    if (focusTarget) {
      scheduleFocusRestore(() => {
        setFocusedContainer(context.root, focusTarget);
        context.adapter.activate(focusTarget.window);
        workspace.lastFocusedWindowId = focusTarget.windowId;
      });
    }

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
    } else if (mode === "enable" || mode === "on") {
      floating = true;
    } else if (mode === "disable" || mode === "off") {
      floating = false;
    }

    focused.floating = floating;
    context.adapter.setFloating(focused.window, floating);

    const workspace = findWorkspaceForContainer(focused);
      if (workspace) {
        workspace.removeFloatingWindow(focused);
        if (floating) {
          workspace.addFloatingWindow(focused);
        }
        reflow(workspace);
        applyLayout(workspace, context.adapter);
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
