import { ContainerType } from "../../../src/tree/types.ts";
import { RootContainer } from "../../../src/tree/root-container.ts";
import { OutputContainer } from "../../../src/tree/output-container.ts";
import { WorkspaceContainer } from "../../../src/tree/workspace-container.ts";
import { SplitContainer } from "../../../src/tree/split-container.ts";
import { WindowContainer } from "../../../src/tree/window-container.ts";
import { buildDebugPayload } from "../../../src/ipc/debug.ts";

describe("ipc debug payload", () => {
  it("summarizes tree, focus, and monitors", () => {
    const root = new RootContainer(1);
    const output = new OutputContainer(2, 0, { x: 0, y: 0, width: 100, height: 50 });
    const workspace = new WorkspaceContainer(3, "1", 1, true, false);
    const split = new SplitContainer(4);
    const window = new WindowContainer(5, {}, 101, "app.one", "One");

    root.addOutput(output);
    output.addChild(workspace);
    workspace.addChild(split);
    split.addChild(window);
    window.focused = true;

    const result = buildDebugPayload({
      root,
      monitors: {
        layoutManagerCount: 1,
        displayCount: 1,
        workAreas: [{ x: 0, y: 0, width: 100, height: 50 }],
      },
      ipc: { socketPath: "/run/user/1000/tessera.sock.123", pid: 123 },
      extension: {
        rebuildCount: 2,
        lastRebuildReason: "idle",
        lastRebuildMonitors: 1,
        lastRebuildOutputs: 1,
        pollAttempts: 3,
        lastPollMonitors: 1,
        lastPollOutputs: 1,
        pollingActive: false,
      },
      windows: [
        {
          id: 101,
          title: "One",
          wmClass: "app.one",
          type: 0,
          maximized: false,
          frameRect: { x: 0, y: 0, width: 100, height: 50 },
          minWidth: 20,
          minHeight: 10,
          canMove: true,
          canResize: true,
        },
      ],
      version: { uuid: "tessera@tessera.dev", version: "0.1.0" },
    });

    expect(result.tree.outputs).toBe(1);
    expect(result.tree.hasWorkspace).toBe(true);
    expect(result.tracker.trackedWindows).toBe(1);
    expect(result.focus.focusedContainerId).toBe(5);
    expect(result.focus.focusedWindowId).toBe(101);
    expect(result.monitors.layoutManagerCount).toBe(1);
    expect(result.monitors.displayCount).toBe(1);
    expect(result.monitors.workAreas).toEqual([
      { x: 0, y: 0, width: 100, height: 50 },
    ]);
    expect(result.ipc.socketPath).toBe("/run/user/1000/tessera.sock.123");
    expect(result.ipc.pid).toBe(123);
    expect(result.extension.rebuildCount).toBe(2);
    expect(result.extension.lastRebuildReason).toBe("idle");
    expect(result.extension.lastRebuildMonitors).toBe(1);
    expect(result.extension.lastRebuildOutputs).toBe(1);
    expect(result.extension.pollAttempts).toBe(3);
    expect(result.extension.lastPollMonitors).toBe(1);
    expect(result.extension.lastPollOutputs).toBe(1);
    expect(result.extension.pollingActive).toBe(false);
    expect(result.version.uuid).toBe("tessera@tessera.dev");
    expect(result.version.version).toBe("0.1.0");
    expect(result.windows).toEqual([
      {
        id: 101,
        title: "One",
        wmClass: "app.one",
        type: 0,
        maximized: false,
        frameRect: { x: 0, y: 0, width: 100, height: 50 },
        minWidth: 20,
        minHeight: 10,
        canMove: true,
        canResize: true,
      },
    ]);
    expect(result.tree.containerTypes).toEqual([
      ContainerType.Output,
      ContainerType.Workspace,
      ContainerType.Split,
      ContainerType.Window,
    ]);
  });

  it("handles null root", () => {
    const result = buildDebugPayload({
      root: null,
      monitors: {
        layoutManagerCount: 0,
        displayCount: 0,
        workAreas: [],
      },
      ipc: { socketPath: null, pid: 0 },
      extension: {
        rebuildCount: 0,
        lastRebuildReason: "",
        lastRebuildMonitors: 0,
        lastRebuildOutputs: 0,
        pollAttempts: 0,
        lastPollMonitors: 0,
        lastPollOutputs: 0,
        pollingActive: false,
      },
      windows: [],
      version: { uuid: "tessera@tessera.dev", version: null },
    });

    expect(result.tree.outputs).toBe(0);
    expect(result.tree.hasWorkspace).toBe(false);
    expect(result.tracker.trackedWindows).toBe(0);
    expect(result.focus.focusedContainerId).toBeNull();
    expect(result.focus.focusedWindowId).toBeNull();
    expect(result.extension.rebuildCount).toBe(0);
    expect(result.extension.lastRebuildReason).toBe("");
    expect(result.extension.lastRebuildMonitors).toBe(0);
    expect(result.extension.lastRebuildOutputs).toBe(0);
    expect(result.extension.pollAttempts).toBe(0);
    expect(result.extension.lastPollMonitors).toBe(0);
    expect(result.extension.lastPollOutputs).toBe(0);
    expect(result.extension.pollingActive).toBe(false);
    expect(result.windows).toEqual([]);
  });
});
