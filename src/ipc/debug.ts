import { ContainerType } from "../tree/types.js";
import type { RootContainer } from "../tree/root-container.js";
import type { Container } from "../tree/container.js";
import type { WindowContainer } from "../tree/window-container.js";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DebugMonitors = {
  layoutManagerCount: number;
  displayCount: number;
  workAreas: Rect[];
};

type DebugIpc = {
  socketPath: string | null;
  pid: number;
};

type DebugVersion = {
  uuid: string;
  version: string | null;
};

type DebugExtension = {
  rebuildCount: number;
  lastRebuildReason: string;
  lastRebuildMonitors: number;
  lastRebuildOutputs: number;
  pollAttempts: number;
  lastPollMonitors: number;
  lastPollOutputs: number;
  pollingActive: boolean;
};

type DebugWindowInfo = {
  id: number;
  title: string;
  wmClass: string | null;
  type: number;
  maximized: boolean;
  frameRect: Rect;
  minWidth: number;
  minHeight: number;
  canMove: boolean;
  canResize: boolean;
};

type DebugInput = {
  root: RootContainer | null;
  monitors: DebugMonitors;
  ipc: DebugIpc;
  extension: DebugExtension;
  windows: DebugWindowInfo[];
  version: DebugVersion;
};

type DebugPayload = {
  ipc: DebugIpc;
  monitors: DebugMonitors;
  extension: DebugExtension;
  tree: {
    outputs: number;
    hasWorkspace: boolean;
    containerTypes: ContainerType[];
  };
  focus: {
    focusedContainerId: number | null;
    focusedWindowId: number | null;
  };
  tracker: {
    trackedWindows: number;
  };
  windows: DebugWindowInfo[];
  version: DebugVersion;
};

const walkContainers = (
  container: Container,
  visit: (node: Container) => void
): void => {
  for (const child of container.children) {
    visit(child);
    walkContainers(child, visit);
  }
};

const findFocusedContainer = (root: RootContainer): Container | null => {
  let focused: Container | null = null;
  walkContainers(root, (node) => {
    if (node.focused) {
      focused = node;
    }
  });
  return focused;
};

const getFocusedWindowId = (root: RootContainer): number | null => {
  let windowId: number | null = null;
  walkContainers(root, (node) => {
    if (node.type === ContainerType.Window && node.focused) {
      windowId = (node as WindowContainer).windowId;
    }
  });
  return windowId;
};

const collectContainerTypes = (root: RootContainer): ContainerType[] => {
  const types: ContainerType[] = [];
  walkContainers(root, (node) => {
    types.push(node.type);
  });
  return types;
};

const countContainers = (root: RootContainer, type: ContainerType): number => {
  let count = 0;
  walkContainers(root, (node) => {
    if (node.type === type) {
      count += 1;
    }
  });
  return count;
};

const hasContainerType = (root: RootContainer, type: ContainerType): boolean =>
  countContainers(root, type) > 0;

export const buildDebugPayload = ({
  root,
  monitors,
  ipc,
  extension,
  windows,
  version,
}: DebugInput): DebugPayload => {
  if (!root) {
    return {
      ipc,
      monitors,
      extension,
      tree: {
        outputs: 0,
        hasWorkspace: false,
        containerTypes: [],
      },
      focus: {
        focusedContainerId: null,
        focusedWindowId: null,
      },
      tracker: {
        trackedWindows: 0,
      },
      windows,
      version,
    };
  }

  const focused = findFocusedContainer(root);
  const focusedWindowId = getFocusedWindowId(root);

  return {
    ipc,
    monitors,
    extension,
    tree: {
      outputs: countContainers(root, ContainerType.Output),
      hasWorkspace: hasContainerType(root, ContainerType.Workspace),
      containerTypes: collectContainerTypes(root),
    },
    focus: {
      focusedContainerId: focused?.id ?? null,
      focusedWindowId,
    },
    tracker: {
      trackedWindows: countContainers(root, ContainerType.Window),
    },
    windows,
    version,
  };
};
