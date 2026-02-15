import { Container, ContainerType } from "../../src/tree/container.ts";
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
});
