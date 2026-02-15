import Meta from "gi://Meta";
import Shell from "gi://Shell";

import { reflow } from "./tree/reflow.js";
import { Container, ContainerType, Rect } from "./tree/container.js";
import { RootContainer } from "./tree/root-container.js";
import { SplitContainer } from "./tree/split-container.js";
import { WorkspaceContainer } from "./tree/workspace-container.js";
import { WindowContainer } from "./tree/window-container.js";

export class WindowTracker {
  private root: RootContainer;
  private windowMap: Map<number, WindowContainer>;
  private windowSignals: Map<number, number[]>;
  private displaySignal: number | null;

  constructor(root: RootContainer) {
    this.root = root;
    this.windowMap = new Map();
    this.windowSignals = new Map();
    this.displaySignal = null;
  }

  start(): void {
    if (this.displaySignal !== null) {
      return;
    }

    this.displaySignal = global.display.connect(
      "window-created",
      (_display, window) => {
        this.trackWindow(window as Meta.Window);
      }
    );

    for (const actor of global.get_window_actors()) {
      const window = actor.meta_window as Meta.Window;
      this.trackWindow(window);
    }
  }

  stop(): void {
    if (this.displaySignal !== null) {
      global.display.disconnect(this.displaySignal);
      this.displaySignal = null;
    }

    for (const [windowId, container] of this.windowMap.entries()) {
      this.detachWindowSignals(windowId);
      if (container.parent) {
        container.parent.removeChild(container);
      }
    }

    this.windowMap.clear();
    this.windowSignals.clear();
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

  private trackWindow(window: Meta.Window): void {
    const windowId = this.getWindowId(window);
    if (this.windowMap.has(windowId)) {
      return;
    }

    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      return;
    }

    const appId = this.getAppId(window);
    const title = window.get_title() ?? "";
    const container = new WindowContainer(
      windowId,
      window,
      windowId,
      appId,
      title
    );

    const split = this.findSplitTarget(workspace);
    split.addChild(container);

    this.windowMap.set(windowId, container);
    this.attachWindowSignals(windowId, window, container);

    reflow(split);
    this.applyLayout(split);
  }

  private attachWindowSignals(
    windowId: number,
    window: Meta.Window,
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

    this.windowSignals.set(windowId, signalIds);
  }

  private detachWindowSignals(windowId: number): void {
    const container = this.windowMap.get(windowId);
    const signals = this.windowSignals.get(windowId);
    if (!container || !signals) {
      return;
    }

    for (const signalId of signals) {
      (container.window as Meta.Window).disconnect(signalId);
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

    if (parent) {
      reflow(parent);
      this.applyLayout(parent);
    }
  }

  private findSplitTarget(workspace: WorkspaceContainer): SplitContainer {
    const existing = workspace.children.find(
      (child) => child.type === ContainerType.Split
    ) as SplitContainer | undefined;

    if (existing) {
      return existing;
    }

    const split = new SplitContainer(this.nextContainerId());
    split.rect = { ...workspace.rect };
    workspace.addChild(split);
    return split;
  }

  private applyLayout(container: Container): void {
    for (const child of container.children) {
      if (child.type === ContainerType.Window) {
        const windowContainer = child as WindowContainer;
        this.applyGeometry(windowContainer.window as Meta.Window, child.rect);
      } else if (child.children.length > 0) {
        this.applyLayout(child);
      }
    }
  }

  private applyGeometry(window: Meta.Window, rect: Rect): void {
    window.move_resize_frame(true, rect.x, rect.y, rect.width, rect.height);
  }

  private getWindowId(window: Meta.Window): number {
    if (typeof window.get_id === "function") {
      return window.get_id();
    }

    return window.get_stable_sequence();
  }

  private getAppId(window: Meta.Window): string {
    const tracker = Shell.WindowTracker.get_default();
    const app = tracker.get_window_app(window);
    if (app) {
      return app.get_id();
    }

    return window.get_wm_class() ?? "";
  }

  private nextContainerId(): number {
    return Math.max(0, ...this.windowMap.keys()) + 1;
  }
}
