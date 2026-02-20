import type MetaModule from "gi://Meta";
import { findReflowRoot, normalizeTree, reflow } from "./tree/reflow.js";
import { Container, ContainerType, Layout } from "./tree/container.js";
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
import { evaluateRules } from "./rules.js";

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
  private trackerSignals: Map<number, number>;
  private displaySignal: number | null;
  private focusSignal: number | null;
  private adapter: WindowAdapter;
  private layoutRetries: Map<number, number>;
  private getConfig: () => TesseraConfig;
  private executeForTarget: ((command: string, target: WindowContainer) => void) | null;
  private onLayoutApplied: (() => void) | null;
  private onFocusChanged: (() => void) | null;
  private shouldSkipWindow: ((window: unknown) => boolean) | null;

  constructor(
    root: RootContainer,
    getConfig: () => TesseraConfig,
    options?: {
      executeForTarget?: (command: string, target: WindowContainer) => void;
      onLayoutApplied?: () => void;
      onFocusChanged?: () => void;
      shouldSkipWindow?: (window: unknown) => boolean;
    }
  ) {
    this.root = root;
    this.getConfig = getConfig;
    this.executeForTarget = options?.executeForTarget ?? null;
    this.onLayoutApplied = options?.onLayoutApplied ?? null;
    this.onFocusChanged = options?.onFocusChanged ?? null;
    this.shouldSkipWindow = options?.shouldSkipWindow ?? null;
    this.windowMap = new Map();
    this.windowSignals = new Map();
    this.trackerSignals = new Map();
    this.displaySignal = null;
    this.focusSignal = null;
    this.layoutRetries = new Map();
    this.adapter = {
      activate: () => {},
      moveResize: (window: unknown, rect) => {
        const mw = window as MetaWindow;
        const before = mw.get_frame_rect();
        const title = mw.get_title?.() ?? "?";
        appendLog(`moveResize "${title}" before={x:${before.x},y:${before.y},w:${before.width},h:${before.height}} target={x:${rect.x},y:${rect.y},w:${rect.width},h:${rect.height}}`);
        mw.move_resize_frame(false, rect.x, rect.y, rect.width, rect.height);
      },
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
      changeWorkspace: () => {},
      moveToWorkspace: () => {},
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
        this.onFocusChanged?.();
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

    if (this.shouldSkipWindow?.(window)) {
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

    const currentFocus = global.display.get_focus_window() as MetaWindow | null;
    if (currentFocus) {
      updateFocusedWindow(this.root, this.windowMap, currentFocus);
    }

    const { rules } = this.getConfig();
    if (rules.length > 0 && this.executeForTarget) {
      const ruleCommands = evaluateRules(rules, container);
      for (const cmd of ruleCommands) {
        this.executeForTarget(cmd, container);
      }
    }

    reflow(split);
    applyLayout(split, this.adapter);
    this.onLayoutApplied?.();

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

    if (Shell && container.appId.startsWith("window:")) {
      const tracker = Shell.WindowTracker.get_default();
      const trackerSignalId = tracker.connect("tracked-windows-changed", () => {
        const resolved = this.getAppId(window);
        if (!resolved.startsWith("window:")) {
          container.appId = resolved;
          tracker.disconnect(trackerSignalId);
          this.trackerSignals.delete(windowId);
        }
      });
      this.trackerSignals.set(windowId, trackerSignalId);
    }
  }

  private scheduleLayoutRetry(container: WindowContainer): void {
    const window = container.window as MetaWindow;
    const windowId = this.getWindowId(window);
    if (this.layoutRetries.has(windowId)) {
      return;
    }

    this.layoutRetries.set(windowId, 0);
    const maxAttempts = 10;
    // While the window hasn't mapped yet (frame size is 0×0) we wait without
    // counting down the resize-retry budget.
    const maxWaitTicks = 150; // 15 s at 100 ms
    const intervalMs = 100;
    // Require N consecutive matching ticks before stopping. This catches
    // terminal emulators (e.g. VTE) that briefly accept tessera's size on
    // mapping and then immediately resize themselves to a character-grid size.
    const requiredConsecutiveMatches = 5; // 500 ms of stability
    let totalTicks = 0;
    let consecutiveMatches = 0;

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
      if (!container.parent) {
        this.layoutRetries.delete(windowId);
        return GLib.SOURCE_REMOVE;
      }

      totalTicks += 1;
      const desired = container.rect;
      const actual = window.get_frame_rect();

      // Window not yet mapped — keep waiting without spending resize attempts.
      if (actual.width === 0 && actual.height === 0) {
        consecutiveMatches = 0;
        if (totalTicks >= maxWaitTicks) {
          this.layoutRetries.delete(windowId);
          return GLib.SOURCE_REMOVE;
        }
        return GLib.SOURCE_CONTINUE;
      }

      const matches =
        desired.x === actual.x &&
        desired.y === actual.y &&
        desired.width === actual.width &&
        desired.height === actual.height;

      if (matches) {
        consecutiveMatches += 1;
        if (consecutiveMatches >= requiredConsecutiveMatches) {
          this.layoutRetries.delete(windowId);
          return GLib.SOURCE_REMOVE;
        }
        return GLib.SOURCE_CONTINUE;
      }

      // Mismatch — reset stability counter, count the resize attempt, reapply.
      consecutiveMatches = 0;
      const attempts = (this.layoutRetries.get(windowId) ?? 0) + 1;
      this.layoutRetries.set(windowId, attempts);

      const parent = container.parent;
      if (parent) {
        const reflowRoot = findReflowRoot(parent);
        reflow(reflowRoot);
        applyLayout(reflowRoot, this.adapter);
        this.onLayoutApplied?.();
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
            const floatReflowRoot = findReflowRoot(parent);
            reflow(floatReflowRoot);
            applyLayout(floatReflowRoot, this.adapter);
            this.onLayoutApplied?.();
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

  private scanForFloatingWorkspace(container: WindowContainer): WorkspaceContainer | null {
    for (const output of this.root.children) {
      for (const ws of output.children) {
        if (ws.type === ContainerType.Workspace) {
          const workspace = ws as WorkspaceContainer;
          if (workspace.getFloatingWindows().includes(container)) {
            return workspace;
          }
        }
      }
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

    const trackerSignalId = this.trackerSignals.get(windowId);
    if (Shell && trackerSignalId !== undefined) {
      Shell.WindowTracker.get_default().disconnect(trackerSignalId);
      this.trackerSignals.delete(windowId);
    }
  }

  private handleWindowRemoved(windowId: number): void {
    const container = this.windowMap.get(windowId);
    if (!container) {
      return;
    }

    // Find the workspace while parent is still set, before removeChild clears it
    const floatingWorkspace = container.floating
      ? (this.findWorkspace(container) ?? this.scanForFloatingWorkspace(container))
      : null;

    const parent = container.parent;
    if (parent) {
      parent.removeChild(container);
    }

    if (floatingWorkspace) {
      floatingWorkspace.removeFloatingWindow(container);
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
      // Capture reflow root before normalizeTree, which may orphan `parent`
      // by collapsing it (setting parent.parent = null) when it has one child.
      const reflowRoot = findReflowRoot(parent);
      if (!result?.handled) {
        normalizeTree(parent);
      }
      reflow(reflowRoot);
      applyLayout(reflowRoot, this.adapter);
      this.onLayoutApplied?.();
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

    const split = new SplitContainer(this.root.nextId(), Layout.Alternating);
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
