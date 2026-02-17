import type MetaModule from "gi://Meta";
import { normalizeTree, reflow } from "./tree/reflow.js";
import { Container, ContainerType } from "./tree/container.js";
import { RootContainer } from "./tree/root-container.js";
import { SplitContainer } from "./tree/split-container.js";
import { WorkspaceContainer } from "./tree/workspace-container.js";
import { WindowContainer } from "./tree/window-container.js";
import { applyLayout } from "./tree/apply-layout.js";
import type { WindowAdapter } from "./commands/adapter.js";
import type { TesseraConfig } from "./config.js";
import { updateFocusedWindow } from "./window-tracker-focus.js";
import { getLayoutStrategy } from "./layout/strategy.js";
import { appendLog } from "./logging.js";
import { insertWindowWithStrategy } from "./window-insertion.js";

type GiModules = {
  Shell?: typeof import("gi://Shell").default;
  GLib?: typeof import("gi://GLib").default;
};

const gi = (globalThis as { imports?: { gi?: GiModules } }).imports?.gi;
const Shell = gi?.Shell as typeof import("gi://Shell").default;
const GLib = gi?.GLib as typeof import("gi://GLib").default;

const findFocusedWindow = (container: Container): WindowContainer | null => {
  if (container.focused && container instanceof WindowContainer) {
    return container;
  }

  for (const child of container.children) {
    const focused = findFocusedWindow(child);
    if (focused) {
      return focused;
    }
  }

  return null;
};

type MetaWindow = MetaModule.Window;


export class WindowTracker {
  private root: RootContainer;
  private windowMap: Map<number, WindowContainer>;
  private windowSignals: Map<number, number[]>;
  private displaySignal: number | null;
  private focusSignal: number | null;
  private adapter: WindowAdapter;
  private layoutRetries: Map<number, number>;
  private getConfig: () => TesseraConfig;

  constructor(root: RootContainer, getConfig: () => TesseraConfig) {
    this.root = root;
    this.getConfig = getConfig;
    this.windowMap = new Map();
    this.windowSignals = new Map();
    this.displaySignal = null;
    this.focusSignal = null;
    this.layoutRetries = new Map();
    this.adapter = {
      activate: () => {},
      moveResize: (window: unknown, rect) => {
        (window as MetaWindow).move_resize_frame(
          false,
          rect.x,
          rect.y,
          rect.width,
          rect.height
        );
      },
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
    };
  }

  start(): void {
    if (this.displaySignal !== null) {
      return;
    }

    this.displaySignal = global.display.connect(
      "window-created",
      (_display, window) => {
        this.trackWindow(window as MetaWindow);
      }
    );

    this.focusSignal = global.display.connect(
      "notify::focus-window",
      () => {
        const focused = global.display.get_focus_window() as MetaWindow | null;
        updateFocusedWindow(this.root, this.windowMap, focused);
      }
    );

    for (const actor of global.get_window_actors()) {
      const window = actor.meta_window as MetaWindow;
      this.trackWindow(window);
    }

    const focused = global.display.get_focus_window() as MetaWindow | null;
    updateFocusedWindow(this.root, this.windowMap, focused);
  }

  stop(): void {
    if (this.displaySignal !== null) {
      global.display.disconnect(this.displaySignal);
      this.displaySignal = null;
    }

    if (this.focusSignal !== null) {
      global.display.disconnect(this.focusSignal);
      this.focusSignal = null;
    }

    for (const [windowId, container] of this.windowMap.entries()) {
      this.detachWindowSignals(windowId);
      if (container.parent) {
        container.parent.removeChild(container);
      }
    }

    this.windowMap.clear();
    this.windowSignals.clear();
    updateFocusedWindow(this.root, this.windowMap, null);
  }

  getActiveWorkspace(): WorkspaceContainer | null {
    const output = this.root.getOutput(0);
    if (!output) {
      return null;
    }

    const visible = output.children.find(
      (child) => child.type === ContainerType.Workspace &&
        (child as WorkspaceContainer).visible
    ) as WorkspaceContainer | undefined;

    if (visible) {
      return visible;
    }

    return (output.children.find(
      (child) => child.type === ContainerType.Workspace
    ) as WorkspaceContainer | undefined) ?? null;
  }

  private trackWindow(window: MetaWindow): void {
    const windowId = this.getWindowId(window);
    if (this.windowMap.has(windowId)) {
      return;
    }

    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      return;
    }

    if (window.is_maximized?.()) {
      window.unmaximize();
    }

    const appId = this.getAppId(window);
    const title = window.get_title() ?? "";
    const container = new WindowContainer(
      this.root.nextId(),
      window,
      windowId,
      appId,
      title
    );

    const split = this.findSplitTarget(workspace);
    const { minTileWidth, minTileHeight } = this.getConfig();
    const tiledCount = split.children.filter(
      (child) => child.type === ContainerType.Window &&
        !(child as WindowContainer).floating
    ).length;
    const projectedCount = tiledCount + 1;
    const shouldFloat = getLayoutStrategy(split.layout).shouldFloatOnAdd(
      workspace.rect,
      projectedCount,
      minTileWidth,
      minTileHeight
    );

    if (shouldFloat) {
      container.floating = true;
      workspace.addFloatingWindow(container);
      this.adapter.setFloating(window, true);
      const frameRect = window.get_frame_rect();
      const width = Math.min(frameRect.width, workspace.rect.width);
      const height = Math.min(frameRect.height, workspace.rect.height);
      const x = workspace.rect.x + Math.floor((workspace.rect.width - width) / 2);
      const y = workspace.rect.y + Math.floor((workspace.rect.height - height) / 2);
      container.rect = { x, y, width, height };
      this.adapter.moveResize(window, container.rect);
    }

    const focused = findFocusedWindow(this.root) ?? container;
    const mode = "focused";
    insertWindowWithStrategy({
      root: this.root,
      split,
      container,
      focused,
      mode,
      log: appendLog,
    });

    this.windowMap.set(windowId, container);
    this.attachWindowSignals(windowId, window, container);

    reflow(split);
    applyLayout(split, this.adapter);

    if (!container.floating) {
      this.scheduleLayoutRetry(container);
    }
  }

  private attachWindowSignals(
    windowId: number,
    window: MetaWindow,
    container: WindowContainer
  ): void {
    const signalIds: number[] = [];

    signalIds.push(
      window.connect("unmanaged", () => {
        this.handleWindowRemoved(windowId);
      })
    );

    signalIds.push(
      window.connect("notify::title", () => {
        container.title = window.get_title() ?? "";
      })
    );

    signalIds.push(
      window.connect("notify::maximized-horizontally", () => {
        if (window.is_maximized?.()) {
          window.unmaximize();
        }
      })
    );

    signalIds.push(
      window.connect("notify::maximized-vertically", () => {
        if (window.is_maximized?.()) {
          window.unmaximize();
        }
      })
    );

    this.windowSignals.set(windowId, signalIds);
  }

  private scheduleLayoutRetry(container: WindowContainer): void {
    const window = container.window as MetaWindow;
    const windowId = this.getWindowId(window);
    if (this.layoutRetries.has(windowId)) {
      return;
    }

    this.layoutRetries.set(windowId, 0);
    const maxAttempts = 10;
    const intervalMs = 100;

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
      if (!container.parent) {
        this.layoutRetries.delete(windowId);
        return GLib.SOURCE_REMOVE;
      }

      const attempts = (this.layoutRetries.get(windowId) ?? 0) + 1;
      this.layoutRetries.set(windowId, attempts);

      const desired = container.rect;
      const actual = window.get_frame_rect();
      const matches =
        desired.x === actual.x &&
        desired.y === actual.y &&
        desired.width === actual.width &&
        desired.height === actual.height;

      if (!matches) {
        const parent = container.parent;
        if (parent) {
          reflow(parent);
          applyLayout(parent, this.adapter);
        }
      }

      if (matches) {
        this.layoutRetries.delete(windowId);
        return GLib.SOURCE_REMOVE;
      }

      if (attempts >= maxAttempts) {
        const workspace = this.findWorkspace(container);
        const parent = container.parent;
        if (workspace && parent) {
          const { minTileWidth, minTileHeight } = this.getConfig();
          const tiledCount = parent.children.filter(
            (child) => child.type === ContainerType.Window &&
              !(child as WindowContainer).floating
          ).length;
          const shouldFloat = getLayoutStrategy(parent.layout).shouldFloatOnRetry(
            workspace.rect,
            tiledCount,
            minTileWidth,
            minTileHeight,
            actual
          );

          if (shouldFloat) {
            container.floating = true;
            workspace.addFloatingWindow(container);
            this.adapter.setFloating(window, true);
            const width = Math.min(actual.width, workspace.rect.width);
            const height = Math.min(actual.height, workspace.rect.height);
            const x =
              workspace.rect.x + Math.floor((workspace.rect.width - width) / 2);
            const y =
              workspace.rect.y +
              Math.floor((workspace.rect.height - height) / 2);
            container.rect = { x, y, width, height };
            this.adapter.moveResize(window, container.rect);
            reflow(parent);
            applyLayout(parent, this.adapter);
          }
        }

        this.layoutRetries.delete(windowId);
        return GLib.SOURCE_REMOVE;
      }

      return GLib.SOURCE_CONTINUE;
    });
  }

  private findWorkspace(container: Container): WorkspaceContainer | null {
    let current: Container | null = container.parent;
    while (current) {
      if (current.type === ContainerType.Workspace) {
        return current as WorkspaceContainer;
      }
      current = current.parent;
    }

    return null;
  }

  private detachWindowSignals(windowId: number): void {
    const container = this.windowMap.get(windowId);
    const signals = this.windowSignals.get(windowId);
    if (!container || !signals) {
      return;
    }

    for (const signalId of signals) {
      (container.window as MetaWindow).disconnect(signalId);
    }

    this.windowSignals.delete(windowId);
  }

  private handleWindowRemoved(windowId: number): void {
    const container = this.windowMap.get(windowId);
    if (!container) {
      return;
    }

    const parent = container.parent;
    if (parent) {
      parent.removeChild(container);
    }

    this.detachWindowSignals(windowId);
    this.windowMap.delete(windowId);
    this.layoutRetries.delete(windowId);

    if (parent) {
      const strategy = getLayoutStrategy(parent.layout);
      const result = strategy.onWindowRemoved?.({
        root: this.root,
        parent,
        removed: container,
      });
      if (!result?.handled) {
        normalizeTree(parent);
      }
      reflow(parent);
      applyLayout(parent, this.adapter);
    }

    const focused = global.display.get_focus_window() as MetaWindow | null;
    updateFocusedWindow(this.root, this.windowMap, focused);
  }

  private findSplitTarget(workspace: WorkspaceContainer): SplitContainer {
    const existing = workspace.children.find(
      (child) => child.type === ContainerType.Split
    ) as SplitContainer | undefined;

    if (existing) {
      return existing;
    }

    const split = new SplitContainer(this.root.nextId());
    split.rect = { ...workspace.rect };
    workspace.addChild(split);
    return split;
  }

  private getWindowId(window: MetaWindow): number {
    if (typeof window.get_id === "function") {
      return window.get_id();
    }

    return window.get_stable_sequence();
  }

  private getAppId(window: MetaWindow): string {
    const tracker = Shell.WindowTracker.get_default();
    const app = tracker.get_window_app(window);
    if (app) {
      return app.get_id();
    }

    return window.get_wm_class() ?? "";
  }

}
