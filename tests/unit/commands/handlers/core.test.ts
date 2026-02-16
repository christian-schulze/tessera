import type { Command, CommandHandler } from "../../../../src/commands/types.ts";
import { WindowContainer } from "../../../../src/tree/window-container.ts";
import { SplitContainer } from "../../../../src/tree/split-container.ts";
import { Layout } from "../../../../src/tree/container.ts";
import { focusHandler, layoutHandler, moveHandler, resizeHandler, splitHandler } from "../../../../src/commands/handlers/core.ts";

describe("Core command handlers", () => {
  const makeCommand = (action: string, args: string[] = []): Command => ({
    raw: action,
    action,
    args,
    criteria: [],
  });

  const makeAdapter = () => ({
    activated: [] as unknown[],
    activate(window: unknown) {
      this.activated.push(window);
    },
    moveResize: jasmine.createSpy("moveResize"),
    setFullscreen: () => {},
    setFloating: () => {},
    close: () => {},
    exec: () => {},
  });

  it("focus activates the focused window", () => {
    const window = {};
    const focused = new WindowContainer("win", window, 1, "app", "title");
    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 };

    const result = focusHandler.execute(makeCommand("focus"), {
      root: focused as any,
      focused,
      adapter,
      config,
    });

    expect(result.success).toBeTrue();
    expect(adapter.activated).toEqual([window]);
  });

  it("move reorders a focused window within its parent", () => {
    const windowA = new WindowContainer("a", {}, 1, "app", "A");
    const windowB = new WindowContainer("b", {}, 2, "app", "B");
    const split = new SplitContainer("split");
    split.addChild(windowA);
    split.addChild(windowB);

    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 };

    const result = moveHandler.execute(makeCommand("move", ["left"]), {
      root: split as any,
      focused: windowB,
      adapter,
      config,
    });

    expect(result.success).toBeTrue();
    expect(split.children[0]).toBe(windowB);
    expect(split.children[1]).toBe(windowA);
    expect(adapter.moveResize).toHaveBeenCalled();
  });

  it("resize adjusts focused window proportion", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    window.proportion = 1;

    const parent = new SplitContainer("parent");
    parent.rect = { x: 0, y: 0, width: 1000, height: 800 };
    const sibling = new WindowContainer("sib", {}, 2, "app", "sibling");
    sibling.proportion = 1;
    parent.addChild(window);
    parent.addChild(sibling);
    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 };

    const result = resizeHandler.execute(
      makeCommand("resize", ["grow", "width", "10"]),
      {
        root: parent as any,
        focused: window,
        adapter,
        config,
      }
    );

    expect(result.success).toBeTrue();
    expect(window.rect.width).toBeCloseTo(510);
    expect(adapter.moveResize).toHaveBeenCalled();
  });

  it("resize uses ppt units when provided", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    window.proportion = 1;

    const parent = new SplitContainer("parent");
    parent.rect = { x: 0, y: 0, width: 1000, height: 800 };
    const sibling = new WindowContainer("sib", {}, 2, "app", "sibling");
    sibling.proportion = 1;
    parent.addChild(window);
    parent.addChild(sibling);
    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 };

    const result = resizeHandler.execute(
      makeCommand("resize", ["grow", "width", "10", "ppt"]),
      {
        root: parent as any,
        focused: window,
        adapter,
        config,
      }
    );

    expect(result.success).toBeTrue();
    expect(window.rect.width).toBeCloseTo(600);
    expect(adapter.moveResize).toHaveBeenCalled();
  });

  it("resize set uses absolute sizes", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    window.proportion = 1;

    const parent = new SplitContainer("parent");
    parent.rect = { x: 0, y: 0, width: 1000, height: 800 };
    const sibling = new WindowContainer("sib", {}, 2, "app", "sibling");
    sibling.proportion = 1;
    parent.addChild(window);
    parent.addChild(sibling);
    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 };

    const result = resizeHandler.execute(
      makeCommand("resize", ["set", "width", "60", "ppt"]),
      {
        root: parent as any,
        focused: window,
        adapter,
        config,
      }
    );

    expect(result.success).toBeTrue();
    expect(window.rect.width).toBeCloseTo(600);
    expect(adapter.moveResize).toHaveBeenCalled();
  });

  it("resize applies sequential ppt adjustments against parent size", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    window.proportion = 1;

    const parent = new SplitContainer("parent");
    parent.rect = { x: 0, y: 0, width: 1000, height: 800 };
    const sibling = new WindowContainer("sib", {}, 2, "app", "sibling");
    sibling.proportion = 1;
    parent.addChild(window);
    parent.addChild(sibling);
    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 };

    resizeHandler.execute(makeCommand("resize", ["grow", "width", "20", "ppt"]), {
      root: parent as any,
      focused: window,
      adapter,
      config,
    });

    resizeHandler.execute(makeCommand("resize", ["shrink", "width", "10", "ppt"]), {
      root: parent as any,
      focused: window,
      adapter,
      config,
    });

    expect(window.rect.width).toBeCloseTo(600);
  });

  it("resize clamps to sibling min sizes", () => {
    const minWindow = {
      get_min_size: () => [360, 0] as [number, number],
    };
    const window = new WindowContainer("win", {}, 1, "app", "title");
    window.proportion = 1;

    const parent = new SplitContainer("parent");
    parent.rect = { x: 0, y: 0, width: 1000, height: 800 };
    const sibling = new WindowContainer("sib", minWindow, 2, "app", "sibling");
    sibling.proportion = 1;
    parent.addChild(window);
    parent.addChild(sibling);
    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 };

    const result = resizeHandler.execute(
      makeCommand("resize", ["grow", "width", "60", "ppt"]),
      {
        root: parent as any,
        focused: window,
        adapter,
        config,
      }
    );

    expect(result.success).toBeTrue();
    expect(window.rect.width).toBeCloseTo(640);
    expect(adapter.moveResize).toHaveBeenCalled();
  });

  it("split sets parent layout to splitv", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    const parent = new SplitContainer("parent", Layout.SplitH);
    parent.addChild(window);

    const result = splitHandler.execute(makeCommand("splitv"), {
      root: parent as any,
      focused: window,
      adapter: makeAdapter(),
      config: { minTileWidth: 300, minTileHeight: 240 },
    });

    expect(result.success).toBeTrue();
    expect(parent.layout).toBe(Layout.SplitV);
  });

  it("layout switches parent layout", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    const parent = new SplitContainer("parent", Layout.SplitH);
    parent.addChild(window);

    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 };

    const result = layoutHandler.execute(makeCommand("layout", ["stacking"]), {
      root: parent as any,
      focused: window,
      adapter,
      config,
    });

    expect(result.success).toBeTrue();
    expect(parent.layout).toBe(Layout.Stacking);
    expect(adapter.moveResize).toHaveBeenCalled();
  });

  it("layout supports alternating", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    const parent = new SplitContainer("parent", Layout.SplitH);
    parent.addChild(window);

    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 };

    const result = layoutHandler.execute(makeCommand("layout", ["alternating"]), {
      root: parent as any,
      focused: window,
      adapter,
      config,
    });

    expect(result.success).toBeTrue();
    expect(parent.layout).toBe(Layout.Alternating);
    expect(adapter.moveResize).toHaveBeenCalled();
  });
});
