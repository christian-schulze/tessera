import { RootContainer } from "../../../../src/tree/root-container.ts";
import { OutputContainer } from "../../../../src/tree/output-container.ts";
import { WorkspaceContainer } from "../../../../src/tree/workspace-container.ts";
import { WindowContainer } from "../../../../src/tree/window-container.ts";
import type { Command } from "../../../../src/commands/types.ts";
import {
  workspaceHandler,
  markHandler,
  unmarkHandler,
  floatingHandler,
  fullscreenHandler,
  stickyHandler,
} from "../../../../src/commands/handlers/workspace.ts";

describe("Workspace and window state handlers", () => {
  const makeCommand = (action: string, args: string[] = []): Command => ({
    raw: [action, ...args].join(" "),
    action,
    args,
    criteria: [],
  });

  const makeAdapter = () => ({
    floating: [] as Array<{ window: unknown; value: boolean }>,
    sticky: [] as Array<{ window: unknown; value: boolean }>,
    fullscreen: [] as Array<{ window: unknown; value: boolean }>,
    activated: [] as unknown[],
    activate(window: unknown) {
      this.activated.push(window);
    },
    moveResize: jasmine.createSpy("moveResize"),
    setFullscreen(window: unknown, value: boolean) {
      this.fullscreen.push({ window, value });
    },
    setFloating(window: unknown, value: boolean) {
      this.floating.push({ window, value });
    },
    setSticky(window: unknown, value: boolean) {
      this.sticky.push({ window, value });
    },
    close: () => {},
    exec: () => {},
    changeWorkspace: () => {},
    moveToWorkspace: () => {},
  });

  it("switches visible workspace by name", () => {
    const root = new RootContainer(0);
    const output = new OutputContainer(1, 0, { x: 0, y: 0, width: 100, height: 100 });
    const workspaceA = new WorkspaceContainer(2, "dev", 1, true);
    const workspaceB = new WorkspaceContainer(3, "web", 2, false);

    root.addOutput(output);
    output.addChild(workspaceA);
    output.addChild(workspaceB);

    const adapter = makeAdapter();

    const result = workspaceHandler.execute(makeCommand("workspace", ["web"]), {
      root,
      focused: workspaceA,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(workspaceA.visible).toBeFalse();
    expect(workspaceB.visible).toBeTrue();
    expect(workspaceB.focused).toBeTrue();
  });

  it("restores last focused window when switching workspaces", () => {
    const root = new RootContainer(0);
    const output = new OutputContainer(1, 0, { x: 0, y: 0, width: 100, height: 100 });
    const workspaceA = new WorkspaceContainer(2, "dev", 1, true);
    const workspaceB = new WorkspaceContainer(3, "web", 2, false);
    const windowA = {};
    const windowB = {};
    const windowContainerA = new WindowContainer(4, windowA, 11, "app", "A");
    const windowContainerB = new WindowContainer(5, windowB, 22, "app", "B");
    windowContainerB.floating = true;

    root.addOutput(output);
    output.addChild(workspaceA);
    output.addChild(workspaceB);
    workspaceB.addChild(windowContainerA);
    workspaceB.addChild(windowContainerB);
    workspaceB.lastFocusedWindowId = 22;

    const adapter = makeAdapter();

    const result = workspaceHandler.execute(makeCommand("workspace", ["web"]), {
      root,
      focused: workspaceA,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(adapter.activated).toEqual([windowA]);
    expect(windowContainerA.focused).toBeTrue();
    expect(workspaceB.lastFocusedWindowId).toBe(22);
  });

  it("falls back to first tiled window when remembered focus is missing", () => {
    const root = new RootContainer(0);
    const output = new OutputContainer(1, 0, { x: 0, y: 0, width: 100, height: 100 });
    const workspaceA = new WorkspaceContainer(2, "dev", 1, true);
    const workspaceB = new WorkspaceContainer(3, "web", 2, false);
    const windowA = {};
    const windowB = {};
    const windowContainerA = new WindowContainer(4, windowA, 11, "app", "A");
    const windowContainerB = new WindowContainer(5, windowB, 22, "app", "B");
    windowContainerB.floating = true;

    root.addOutput(output);
    output.addChild(workspaceA);
    output.addChild(workspaceB);
    workspaceB.addChild(windowContainerA);
    workspaceB.addChild(windowContainerB);
    workspaceB.lastFocusedWindowId = 999;

    const adapter = makeAdapter();

    const result = workspaceHandler.execute(makeCommand("workspace", ["web"]), {
      root,
      focused: workspaceA,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(adapter.activated).toEqual([windowA]);
    expect(windowContainerA.focused).toBeTrue();
    expect(workspaceB.lastFocusedWindowId).toBe(11);
  });

  it("falls back to remembered floating window when workspace has no tiled windows", () => {
    const root = new RootContainer(0);
    const output = new OutputContainer(1, 0, { x: 0, y: 0, width: 100, height: 100 });
    const workspaceA = new WorkspaceContainer(2, "dev", 1, true);
    const workspaceB = new WorkspaceContainer(3, "web", 2, false);
    const windowB = {};
    const windowContainerB = new WindowContainer(5, windowB, 22, "app", "B");
    windowContainerB.floating = true;

    root.addOutput(output);
    output.addChild(workspaceA);
    output.addChild(workspaceB);
    workspaceB.addChild(windowContainerB);
    workspaceB.lastFocusedWindowId = 22;

    const adapter = makeAdapter();

    const result = workspaceHandler.execute(makeCommand("workspace", ["web"]), {
      root,
      focused: workspaceA,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(adapter.activated).toEqual([windowB]);
    expect(windowContainerB.focused).toBeTrue();
  });

  it("falls back to first floating window when no remembered focus exists and workspace has no tiled windows", () => {
    const root = new RootContainer(0);
    const output = new OutputContainer(1, 0, { x: 0, y: 0, width: 100, height: 100 });
    const workspaceA = new WorkspaceContainer(2, "dev", 1, true);
    const workspaceB = new WorkspaceContainer(3, "web", 2, false);
    const windowB = {};
    const windowC = {};
    const windowContainerB = new WindowContainer(5, windowB, 22, "app", "B");
    const windowContainerC = new WindowContainer(6, windowC, 23, "app", "C");
    windowContainerB.floating = true;
    windowContainerC.floating = true;

    root.addOutput(output);
    output.addChild(workspaceA);
    output.addChild(workspaceB);
    workspaceB.addChild(windowContainerB);
    workspaceB.addChild(windowContainerC);

    const adapter = makeAdapter();

    const result = workspaceHandler.execute(makeCommand("workspace", ["web"]), {
      root,
      focused: workspaceA,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(adapter.activated).toEqual([windowB]);
    expect(windowContainerB.focused).toBeTrue();
    expect(workspaceB.lastFocusedWindowId).toBe(22);
  });

  it("restores remembered focus even if switch updates active window", () => {
    const root = new RootContainer(0);
    const output = new OutputContainer(1, 0, { x: 0, y: 0, width: 100, height: 100 });
    const workspaceA = new WorkspaceContainer(2, "dev", 1, true);
    const workspaceB = new WorkspaceContainer(3, "web", 2, false);
    const windowA = {};
    const windowB = {};
    const windowContainerA = new WindowContainer(4, windowA, 11, "app", "A");
    const windowContainerB = new WindowContainer(5, windowB, 22, "app", "B");

    root.addOutput(output);
    output.addChild(workspaceA);
    output.addChild(workspaceB);
    workspaceB.addChild(windowContainerA);
    workspaceB.addChild(windowContainerB);
    workspaceB.lastFocusedWindowId = 11;

    const adapter = makeAdapter();
    adapter.changeWorkspace = () => {
      workspaceB.lastFocusedWindowId = 22;
    };

    const result = workspaceHandler.execute(makeCommand("workspace", ["web"]), {
      root,
      focused: workspaceA,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(adapter.activated).toEqual([windowA]);
    expect(windowContainerA.focused).toBeTrue();
    expect(workspaceB.lastFocusedWindowId).toBe(11);
  });


  it("marks and unmarks focused containers", () => {
    const focused = new WindowContainer(1, {}, 1, "app", "title");
    const adapter = makeAdapter();

    const markResult = markHandler.execute(makeCommand("mark", ["important"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(markResult.success).toBeTrue();
    expect(focused.marks.has("important")).toBeTrue();

    const unmarkResult = unmarkHandler.execute(makeCommand("unmark", ["important"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(unmarkResult.success).toBeTrue();
    expect(focused.marks.has("important")).toBeFalse();
  });

  it("toggles floating and updates workspace list", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    const workspace = new WorkspaceContainer(2, "dev", 1, true);
    workspace.addChild(focused);

    const adapter = makeAdapter();

    const result = floatingHandler.execute(makeCommand("floating", ["toggle"]), {
      root: workspace as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(focused.floating).toBeTrue();
    expect(workspace.getFloatingWindows()).toEqual([focused]);
    expect(adapter.floating).toEqual([{ window, value: true }]);
    expect(adapter.activated).toEqual([window]);
    expect(adapter.moveResize).not.toHaveBeenCalled();
  });

  it("tiles when floating is turned off", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    const workspace = new WorkspaceContainer(2, "dev", 1, true);
    focused.floating = true;
    workspace.addChild(focused);
    workspace.addFloatingWindow(focused);

    const adapter = makeAdapter();

    const result = floatingHandler.execute(makeCommand("floating", ["off"]), {
      root: workspace as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(focused.floating).toBeFalse();
    expect(workspace.getFloatingWindows()).toEqual([]);
    expect(adapter.floating).toEqual([{ window, value: false }]);
    expect(adapter.activated).toEqual([window]);
    expect(adapter.moveResize).toHaveBeenCalled();
  });

  it("toggles fullscreen on focused windows", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    const adapter = makeAdapter();

    const result = fullscreenHandler.execute(makeCommand("fullscreen", ["toggle"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(focused.fullscreen).toBeTrue();
    expect(adapter.fullscreen).toEqual([{ window, value: true }]);
    expect(adapter.activated).toEqual([window]);
  });

  it("toggles sticky on focused floating windows", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    focused.floating = true;
    const adapter = makeAdapter();

    const result = stickyHandler.execute(makeCommand("sticky", ["toggle"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(focused.sticky).toBeTrue();
    expect(adapter.sticky).toEqual([{ window, value: true }]);
    expect(adapter.activated).toEqual([window]);
  });

  it("rejects sticky enable on non-floating windows", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    const adapter = makeAdapter();

    const result = stickyHandler.execute(makeCommand("sticky", ["enable"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeFalse();
    expect(result.message).toBe("Sticky requires a floating window");
    expect(focused.sticky).toBeFalse();
    expect(adapter.sticky).toEqual([]);
  });

  it("allows sticky toggle off on non-floating windows", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    focused.sticky = true;
    const adapter = makeAdapter();

    const result = stickyHandler.execute(makeCommand("sticky", ["toggle"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
    });

    expect(result.success).toBeTrue();
    expect(focused.sticky).toBeFalse();
    expect(adapter.sticky).toEqual([{ window, value: false }]);
    expect(adapter.activated).toEqual([window]);
  });

  it("refreshes inspect overlay after floating/sticky/fullscreen changes", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    focused.floating = true;
    const adapter = makeAdapter();
    const refreshInspect = jasmine.createSpy("refreshInspect");

    floatingHandler.execute(makeCommand("floating", ["on"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
      refreshInspect,
    });
    stickyHandler.execute(makeCommand("sticky", ["on"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
      refreshInspect,
    });
    fullscreenHandler.execute(makeCommand("fullscreen", ["enable"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
      refreshInspect,
    });

    expect(refreshInspect).toHaveBeenCalledTimes(3);
    expect(refreshInspect).toHaveBeenCalledWith(focused);
  });

  it("does not refresh inspect overlay when sticky command is rejected", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    const adapter = makeAdapter();
    const refreshInspect = jasmine.createSpy("refreshInspect");

    const result = stickyHandler.execute(makeCommand("sticky", ["enable"]), {
      root: focused as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const },
      refreshInspect,
    });

    expect(result.success).toBeFalse();
    expect(refreshInspect).not.toHaveBeenCalled();
  });
});
