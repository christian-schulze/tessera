import type { Container } from "./tree/container.js";
import { ContainerType } from "./tree/container.js";
import { WorkspaceContainer } from "./tree/workspace-container.js";

type WorkspaceLike = {
  index?: (() => number) | number;
  get_index?: () => number;
};

type WorkspaceWindowLike = {
  get_workspace?: () => WorkspaceLike | null;
};

export const getWorkspaceIndexFromWindow = (
  window: WorkspaceWindowLike
): number | null => {
  const workspace = window.get_workspace?.() ?? null;
  if (!workspace) {
    return null;
  }

  if (typeof workspace.index === "function") {
    return workspace.index();
  }

  if (typeof workspace.get_index === "function") {
    return workspace.get_index();
  }

  if (typeof workspace.index === "number") {
    return workspace.index;
  }

  return null;
};

export const findWorkspaceByIndex = (
  root: Container,
  index: number
): WorkspaceContainer | null => {
  for (const output of root.children) {
    if (output.type !== ContainerType.Output) {
      continue;
    }

    for (const child of output.children) {
      if (child instanceof WorkspaceContainer && child.number === index + 1) {
        return child;
      }
    }
  }

  return null;
};

export const findWorkspaceForWindow = (
  root: Container,
  window: WorkspaceWindowLike,
  fallback: WorkspaceContainer | null
): WorkspaceContainer | null => {
  const workspaceIndex = getWorkspaceIndexFromWindow(window);
  if (workspaceIndex !== null) {
    const workspace = findWorkspaceByIndex(root, workspaceIndex);
    if (workspace) {
      return workspace;
    }
  }

  return fallback;
};
