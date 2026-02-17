import type { Command, CommandHandler } from "../../../../src/commands/types.ts";
import { WindowContainer } from "../../../../src/tree/window-container.ts";
import { SplitContainer } from "../../../../src/tree/split-container.ts";
import { RootContainer } from "../../../../src/tree/root-container.ts";
import { Layout } from "../../../../src/tree/container.ts";
import { insertWindowWithStrategy } from "../../../../src/window-insertion.ts";
import {
  alternatingModeHandler,
  focusHandler,
  layoutHandler,
  moveHandler,
  resizeHandler,
  splitHandler,
} from "../../../../src/commands/handlers/core.ts";

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
    const window = new WindowContainer(1, {}, 1, "app", "title");
    const parent = new SplitContainer(2, Layout.SplitH);
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
    const config = { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const };

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

  it("alternating-mode updates config", () => {
    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240 } as any;

    const result = alternatingModeHandler.execute(
      makeCommand("alternating-mode", ["tail"]),
      { root: null as any, focused: null as any, adapter, config }
    );

    expect(result.success).toBeTrue();
    expect(config.alternatingMode).toBe("tail");
  });

  it("alternating-mode rejects unknown values", () => {
    const adapter = makeAdapter();
    const config = { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" };

    const result = alternatingModeHandler.execute(
      makeCommand("alternating-mode", ["sideways"]),
      { root: null as any, focused: null as any, adapter, config }
    );

    expect(result.success).toBeFalse();
    expect(result.message).toContain("Unknown alternating mode");
  });

  it("split in alternating focus mode wraps focused with opposite axis", () => {
    const parent = new SplitContainer(1, Layout.Alternating);
    const focused = new WindowContainer(2, {}, 1, "app", "Focus");
    const sibling = new WindowContainer(3, {}, 2, "app", "Sibling");
    const split = new SplitContainer(4, Layout.SplitH);
    split.addChild(focused);
    split.addChild(sibling);
    focused.focused = true;
    parent.addChild(split);

    const config = { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" as const };
    splitHandler.execute(makeCommand("splitv"), {
      root: parent as any,
      focused,
      adapter: makeAdapter(),
      config,
    });

    const wrapped = focused.parent as SplitContainer;
    expect(wrapped.layout).toBe(Layout.SplitV);
    expect(wrapped.children).toContain(focused);
  });

  it("split in alternating tail mode walks to last child and flips axis", () => {
    const parent = new SplitContainer(1, Layout.Alternating);
    const a = new WindowContainer(2, {}, 1, "app", "A");
    const b = new WindowContainer(3, {}, 2, "app", "B");
    const split = new SplitContainer(4, Layout.SplitH);
    split.addChild(a);
    split.addChild(b);
    parent.addChild(split);

    const config = { minTileWidth: 300, minTileHeight: 240, alternatingMode: "tail" as const };
    splitHandler.execute(makeCommand("splitv"), {
      root: parent as any,
      focused: a,
      adapter: makeAdapter(),
      config,
    });

    const tail = split.children[split.children.length - 1] as WindowContainer;
    const wrapped = tail.parent as SplitContainer;
    expect(wrapped.layout).toBe(Layout.SplitV);
  });

  it("alternating focused mode wraps focused when adding window", () => {
    const root = new RootContainer(1);
    const parent = new SplitContainer(2, Layout.Alternating);
    const otherSplit = new SplitContainer(3, Layout.SplitH);
    const inner = new SplitContainer(4, Layout.SplitH);
    const focused = new WindowContainer(5, {}, 1, "app", "Focus");
    const sibling = new WindowContainer(6, {}, 2, "app", "Sibling");
    focused.focused = true;
    inner.addChild(focused);
    inner.addChild(sibling);
    parent.addChild(otherSplit);
    parent.addChild(inner);

    const incoming = new WindowContainer(7, {}, 3, "app", "Incoming");
    insertWindowWithStrategy({
      root,
      split: parent,
      container: incoming,
      focused,
      mode: "focused",
    });

    const wrapped = focused.parent as SplitContainer;
    expect(wrapped.layout).toBe(Layout.SplitV);
    expect(wrapped.children[0]).toBe(focused);
    expect(wrapped.children[1]).toBe(incoming);
    expect(inner.children[0]).toBe(wrapped);
    expect(inner.children[1]).toBe(sibling);
  });

  it("alternating tail mode wraps tail when adding window", () => {
    const root = new RootContainer(1);
    const window = new SplitContainer(2, Layout.SplitH);
    const parent = new SplitContainer(3, Layout.Alternating);
    const inner = new SplitContainer(4, Layout.SplitH);
    const a = new WindowContainer(5, {}, 1, "app", "A");
    const b = new WindowContainer(6, {}, 2, "app", "B");
    a.focused = true;
    inner.addChild(a);
    inner.addChild(b);
    parent.addChild(window);
    parent.addChild(inner);

    const incoming = new WindowContainer(7, {}, 3, "app", "Incoming");
    insertWindowWithStrategy({
      root,
      split: parent,
      container: incoming,
      focused: a,
      mode: "tail",
    });

    const wrapped = b.parent as SplitContainer;
    expect(wrapped.layout).toBe(Layout.SplitV);
    expect(wrapped.children[0]).toBe(b);
    expect(wrapped.children[1]).toBe(incoming);
    expect(inner.children[0]).toBe(a);
    expect(inner.children[1]).toBe(wrapped);
  });
});
