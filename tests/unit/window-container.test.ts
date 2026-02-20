import { WindowContainer } from "../../src/tree/window-container.ts";
import { ContainerType, Layout } from "../../src/tree/container.ts";

describe("WindowContainer", () => {
  it("initializes with window metadata", () => {
    const windowRef = { id: "win" };
    const window = new WindowContainer(1, windowRef, 99, "app.test", "Title");

    expect(window.type).toBe(ContainerType.Window);
    expect(window.window).toBe(windowRef);
    expect(window.windowId).toBe(99);
    expect(window.appId).toBe("app.test");
    expect(window.title).toBe("Title");
    expect(window.floating).toBe(false);
    expect(window.fullscreen).toBe(false);
  });

  it("toJSON includes window metadata", () => {
    const windowRef = { id: "win" };
    const window = new WindowContainer(1, windowRef, 99, "app.test", "Title");
    window.rect = { x: 5, y: 10, width: 100, height: 200 };
    window.layout = Layout.SplitV;
    window.focused = true;
    window.proportion = 2;
    window.floating = true;
    window.fullscreen = true;

    const json = window.toJSON();

    expect(json).toEqual({
      id: 1,
      type: ContainerType.Window,
      layout: Layout.SplitV,
      rect: { x: 5, y: 10, width: 100, height: 200 },
      focused: true,
      marks: [],
      proportion: 2,
      children: [],
      windowId: 99,
      appId: "app.test",
      title: "Title",
      window_type: 0,
      floating: true,
      fullscreen: true,
    });
  });
});
