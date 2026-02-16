import { WorkspaceContainer } from "../../src/tree/workspace-container.ts";
import { Container, ContainerType } from "../../src/tree/container.ts";
import { WindowContainer } from "../../src/tree/window-container.ts";

describe("WorkspaceContainer", () => {
  it("initializes workspace metadata", () => {
    const workspace = new WorkspaceContainer(1, "1", 1, true);

    expect(workspace.type).toBe(ContainerType.Workspace);
    expect(workspace.name).toBe("1");
    expect(workspace.number).toBe(1);
    expect(workspace.visible).toBe(true);
    expect(workspace.urgent).toBe(false);
  });

  it("tracks urgency", () => {
    const workspace = new WorkspaceContainer(1, "1", 1, false);

    workspace.urgent = true;

    expect(workspace.urgent).toBe(true);
  });

  it("counts tiled windows recursively", () => {
    const workspace = new WorkspaceContainer(1, "1", 1, true);
    const split = new Container(2, ContainerType.Split);
    const windowA = new Container(3, ContainerType.Window);
    const windowB = new Container(4, ContainerType.Window);
    const nestedSplit = new Container(5, ContainerType.Split);
    const windowC = new Container(6, ContainerType.Window);

    workspace.addChild(split);
    split.addChild(windowA);
    split.addChild(nestedSplit);
    nestedSplit.addChild(windowB);
    nestedSplit.addChild(windowC);

    expect(workspace.tiledWindowCount()).toBe(3);
  });

  it("tracks and serializes floating windows", () => {
    const workspace = new WorkspaceContainer(1, "1", 1, true);
    const floating = new WindowContainer(2, {}, 10, "demo", "Floating");
    floating.floating = true;

    workspace.addFloatingWindow(floating);
    expect(workspace.getFloatingWindows()).toEqual([floating]);
    expect(workspace.toJSON().floatingWindows).toEqual([floating.toJSON()]);

    workspace.removeFloatingWindow(floating);
    expect(workspace.getFloatingWindows()).toEqual([]);
  });
});
