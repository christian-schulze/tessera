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
    fullscreen: [] as Array<{ window: unknown; value: boolean }>,
    activate: () => {},
    moveResize: jasmine.createSpy("moveResize"),
    setFullscreen(window: unknown, value: boolean) {
      this.fullscreen.push({ window, value });
    },
    setFloating(window: unknown, value: boolean) {
      this.floating.push({ window, value });
    },
    close: () => {},
    exec: () => {},
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
    });

    expect(result.success).toBeTrue();
    expect(workspaceA.visible).toBeFalse();
    expect(workspaceB.visible).toBeTrue();
    expect(workspaceB.focused).toBeTrue();
  });

  it("marks and unmarks focused containers", () => {
    const focused = new WindowContainer("win", {}, 1, "app", "title");
    const adapter = makeAdapter();

    const markResult = markHandler.execute(makeCommand("mark", ["important"]), {
      root: focused as any,
      focused,
      adapter,
    });

    expect(markResult.success).toBeTrue();
    expect(focused.marks.has("important")).toBeTrue();

    const unmarkResult = unmarkHandler.execute(makeCommand("unmark", ["important"]), {
      root: focused as any,
      focused,
      adapter,
    });

    expect(unmarkResult.success).toBeTrue();
    expect(focused.marks.has("important")).toBeFalse();
  });

  it("toggles floating and updates workspace list", () => {
    const window = {};
    const focused = new WindowContainer("win", window, 1, "app", "title");
    const workspace = new WorkspaceContainer(2, "dev", 1, true);
    workspace.addChild(focused);

    const adapter = makeAdapter();

    const result = floatingHandler.execute(makeCommand("floating", ["toggle"]), {
      root: workspace as any,
      focused,
      adapter,
    });

    expect(result.success).toBeTrue();
    expect(focused.floating).toBeTrue();
    expect(workspace.getFloatingWindows()).toEqual([focused]);
    expect(adapter.floating).toEqual([{ window, value: true }]);
    expect(adapter.moveResize).not.toHaveBeenCalled();
  });

  it("tiles when floating is turned off", () => {
    const window = {};
    const focused = new WindowContainer("win", window, 1, "app", "title");
    const workspace = new WorkspaceContainer(2, "dev", 1, true);
    focused.floating = true;
    workspace.addChild(focused);
    workspace.addFloatingWindow(focused);

    const adapter = makeAdapter();

    const result = floatingHandler.execute(makeCommand("floating", ["off"]), {
      root: workspace as any,
      focused,
      adapter,
    });

    expect(result.success).toBeTrue();
    expect(focused.floating).toBeFalse();
    expect(workspace.getFloatingWindows()).toEqual([]);
    expect(adapter.floating).toEqual([{ window, value: false }]);
    expect(adapter.moveResize).toHaveBeenCalled();
  });

  it("toggles fullscreen on focused windows", () => {
    const window = {};
    const focused = new WindowContainer("win", window, 1, "app", "title");
    const adapter = makeAdapter();

    const result = fullscreenHandler.execute(makeCommand("fullscreen", ["toggle"]), {
      root: focused as any,
      focused,
      adapter,
    });

    expect(result.success).toBeTrue();
    expect(focused.fullscreen).toBeTrue();
    expect(adapter.fullscreen).toEqual([{ window, value: true }]);
  });
});
