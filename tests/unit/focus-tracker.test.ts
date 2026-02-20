import { Container, ContainerType } from "../../src/tree/container.ts";
import { RootContainer } from "../../src/tree/root-container.ts";
import { OutputContainer } from "../../src/tree/output-container.ts";
import { WorkspaceContainer } from "../../src/tree/workspace-container.ts";
import { WindowContainer } from "../../src/tree/window-container.ts";
import { updateFocusedWindow } from "../../src/window-tracker-focus.ts";

describe("focus tracking", () => {
  it("marks the focused window container", () => {
    const root = new Container(1, ContainerType.Root);
    const first = new WindowContainer(2, {}, 101, "app.one", "One");
    const second = new WindowContainer(3, {}, 202, "app.two", "Two");

    root.addChild(first);
    root.addChild(second);

    const windowMap = new Map([
      [101, first],
      [202, second],
    ]);

    updateFocusedWindow(root, windowMap, { get_id: () => 202 });

    expect(first.focused).toBe(false);
    expect(second.focused).toBe(true);
  });

  it("clears focus when no window is focused", () => {
    const root = new Container(1, ContainerType.Root);
    const child = new WindowContainer(2, {}, 101, "app.one", "One");
    root.addChild(child);
    child.focused = true;

    const windowMap = new Map([[101, child]]);

    updateFocusedWindow(root, windowMap, null);

    expect(child.focused).toBe(false);
  });

  it("updates visible workspace when focused window moves", () => {
    const root = new RootContainer(1);
    const output = new OutputContainer(2, 0, { x: 0, y: 0, width: 100, height: 100 });
    root.addOutput(output);

    const workspace1 = new WorkspaceContainer(3, "1", 1, true);
    const workspace10 = new WorkspaceContainer(4, "10", 10, false);
    output.addChild(workspace1);
    output.addChild(workspace10);

    const window1 = new WindowContainer(5, {}, 101, "app.one", "One");
    const window10 = new WindowContainer(6, {}, 202, "app.two", "Two");
    workspace1.addChild(window1);
    workspace10.addChild(window10);

    const windowMap = new Map([
      [101, window1],
      [202, window10],
    ]);

    updateFocusedWindow(root, windowMap, {
      get_id: () => 202,
      get_workspace: () => ({ index: () => 9 }),
    });

    expect(window10.focused).toBe(true);
    expect(workspace10.visible).toBe(true);
    expect(workspace1.visible).toBe(false);
  });
});
