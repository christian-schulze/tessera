import { RootContainer } from "../../src/tree/root-container.ts";
import { OutputContainer } from "../../src/tree/output-container.ts";
import { WorkspaceContainer } from "../../src/tree/workspace-container.ts";
import { findWorkspaceForWindow } from "../../src/window-workspace.ts";

describe("window workspace helpers", () => {
  it("prefers workspace from window when available", () => {
    const root = new RootContainer(1);
    const output = new OutputContainer(2, 0, { x: 0, y: 0, width: 100, height: 100 });
    root.addOutput(output);

    const workspace1 = new WorkspaceContainer(3, "1", 1, true);
    const workspace2 = new WorkspaceContainer(4, "2", 2, false);
    output.addChild(workspace1);
    output.addChild(workspace2);

    const window = {
      get_workspace: () => ({ index: () => 1 }),
    };

    const result = findWorkspaceForWindow(root, window, workspace1);

    expect(result).toBe(workspace2);
  });

  it("falls back when window workspace is unavailable", () => {
    const root = new RootContainer(1);
    const output = new OutputContainer(2, 0, { x: 0, y: 0, width: 100, height: 100 });
    root.addOutput(output);

    const workspace1 = new WorkspaceContainer(3, "1", 1, true);
    output.addChild(workspace1);

    const window = {
      get_workspace: () => null,
    };

    const result = findWorkspaceForWindow(root, window, workspace1);

    expect(result).toBe(workspace1);
  });
});
