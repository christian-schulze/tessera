import { WorkspaceContainer } from "../../src/tree/workspace-container.ts";
import { WindowContainer } from "../../src/tree/window-container.ts";
import { isContainerOnActiveWorkspace } from "../../src/inspect-overlay.ts";

describe("inspect overlay workspace visibility", () => {
  it("returns false when container belongs to a different workspace", () => {
    const workspace = new WorkspaceContainer(1, "2", 2, false);
    const window = new WindowContainer(2, {}, 42, "app", "title");
    workspace.addChild(window);

    expect(isContainerOnActiveWorkspace(window, 0)).toBeFalse();
  });

  it("returns true when container belongs to active workspace", () => {
    const workspace = new WorkspaceContainer(1, "2", 2, true);
    const window = new WindowContainer(2, {}, 42, "app", "title");
    workspace.addChild(window);

    expect(isContainerOnActiveWorkspace(window, 1)).toBeTrue();
  });

  it("returns true when active workspace index is unavailable", () => {
    const workspace = new WorkspaceContainer(1, "2", 2, true);
    const window = new WindowContainer(2, {}, 42, "app", "title");
    workspace.addChild(window);

    expect(isContainerOnActiveWorkspace(window, null)).toBeTrue();
  });

  it("returns true for sticky windows on any workspace", () => {
    const workspace = new WorkspaceContainer(1, "2", 2, false);
    const window = new WindowContainer(2, {}, 42, "app", "title");
    window.sticky = true;
    workspace.addChild(window);

    expect(isContainerOnActiveWorkspace(window, 0)).toBeTrue();
  });

  it("returns true when Mutter reports on-all-workspaces", () => {
    const workspace = new WorkspaceContainer(1, "2", 2, false);
    const window = new WindowContainer(
      2,
      { is_on_all_workspaces: () => true },
      42,
      "app",
      "title"
    );
    workspace.addChild(window);

    expect(isContainerOnActiveWorkspace(window, 0)).toBeTrue();
  });
});
