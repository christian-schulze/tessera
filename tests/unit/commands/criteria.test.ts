import { matchesCriteria } from "../../../src/commands/criteria.ts";
import { WindowContainer } from "../../../src/tree/window-container.ts";
import { WorkspaceContainer } from "../../../src/tree/workspace-container.ts";

describe("Command criteria", () => {
  it("matches app_id and title on window containers", () => {
    const window = new WindowContainer("w-1", {}, 1, "firefox", "Docs");

    const matches = matchesCriteria(window, [
      { key: "app_id", operator: "=", value: "firefox" },
      { key: "title", operator: "=", value: "Docs" },
    ]);

    expect(matches).toBeTrue();
  });

  it("matches window_type on window containers", () => {
    const window = new WindowContainer("w-1", {}, 1, "firefox", "Docs", 3);

    const matches = matchesCriteria(window, [
      { key: "window_type", operator: "=", value: "3" },
    ]);

    expect(matches).toBeTrue();
  });

  it("does not match window_type on workspace containers", () => {
    const workspace = new WorkspaceContainer("ws-1", "dev", 1, true);

    const matches = matchesCriteria(workspace, [
      { key: "window_type", operator: "=", value: "0" },
    ]);

    expect(matches).toBeFalse();
  });

  it("matches workspace name on workspace containers", () => {
    const workspace = new WorkspaceContainer("ws-1", "dev", 1, true);

    const matches = matchesCriteria(workspace, [
      { key: "workspace", operator: "=", value: "dev" },
    ]);

    expect(matches).toBeTrue();
  });
});
