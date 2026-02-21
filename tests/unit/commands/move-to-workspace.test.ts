import { CommandEngine } from "../../../src/commands/engine.ts";
import type { Command } from "../../../src/commands/types.ts";
import { registerDefaultHandlers } from "../../../src/commands/index.ts";
import { RootContainer } from "../../../src/tree/root-container.ts";
import { WorkspaceContainer } from "../../../src/tree/workspace-container.ts";
import { SplitContainer } from "../../../src/tree/split-container.ts";
import { WindowContainer } from "../../../src/tree/window-container.ts";
import { OutputContainer } from "../../../src/tree/output-container.ts";
import { Layout } from "../../../src/tree/container.ts";

const makeWindow = (id: number, title: string) => {
  const window = new WindowContainer(id, {} as never, id, "firefox", title);
  window.rect = { x: 0, y: 0, width: 100, height: 100 };
  return window;
};

describe("move container to workspace", () => {
  it("uses alternating insertion when moving into a workspace", () => {
    const root = new RootContainer(1);
    const output = new OutputContainer(8, 0, { x: 0, y: 0, width: 200, height: 100 });
    root.addOutput(output);
    const workspace10 = new WorkspaceContainer(2, "10", 10, true);
    const split = new SplitContainer(3, Layout.SplitH);
    split.alternating = true;
    workspace10.addChild(split);
    output.addChild(workspace10);

    const focusedWindow = makeWindow(4, "Focused");
    split.addChild(focusedWindow);

    const movingWindow = makeWindow(5, "Moving");
    const workspace1 = new WorkspaceContainer(6, "1", 1, false);
    const sourceSplit = new SplitContainer(7, Layout.SplitH);
    sourceSplit.alternating = true;
    workspace1.addChild(sourceSplit);
    sourceSplit.addChild(movingWindow);
    output.addChild(workspace1);

    const engine = new CommandEngine();
    registerDefaultHandlers(engine);

    const command: Command = {
      raw: "move container to workspace 10",
      action: "move",
      args: ["container", "to", "workspace", "10"],
      criteria: [],
    };

    engine.execute(command, {
      root,
      focused: movingWindow,
      adapter: {
        activate: () => {},
        moveResize: () => {},
        setFullscreen: () => {},
        setFloating: () => {},
        close: () => {},
        exec: () => {},
        changeWorkspace: () => {},
        moveToWorkspace: () => undefined,
      },
      config: {
        minTileWidth: 300,
        minTileHeight: 240,
        alternatingMode: "focused",
      } as any,
    });

    const targetSplit = workspace10.children[0] as SplitContainer;
    expect(targetSplit.layout).toBe(Layout.SplitH);
    expect(targetSplit.alternating).toBe(true);
    expect(targetSplit.children.length).toBe(2);
    expect(targetSplit.children.map((child) => child.id)).toEqual([4, 5]);
  });
});
