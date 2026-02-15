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
    moveResize: () => {},
    setFullscreen: () => {},
    setFloating: () => {},
    close: () => {},
    exec: () => {},
  });

  it("focus activates the focused window", () => {
    const window = {};
    const focused = new WindowContainer("win", window, 1, "app", "title");
    const adapter = makeAdapter();

    const result = focusHandler.execute(makeCommand("focus"), {
      root: focused as any,
      focused,
      adapter,
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

    const result = moveHandler.execute(makeCommand("move", ["left"]), {
      root: split as any,
      focused: windowB,
      adapter: makeAdapter(),
    });

    expect(result.success).toBeTrue();
    expect(split.children[0]).toBe(windowB);
    expect(split.children[1]).toBe(windowA);
  });

  it("resize adjusts focused window proportion", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    window.proportion = 1;

    const result = resizeHandler.execute(
      makeCommand("resize", ["grow", "width", "0.5"]),
      {
        root: window as any,
        focused: window,
        adapter: makeAdapter(),
      }
    );

    expect(result.success).toBeTrue();
    expect(window.proportion).toBeCloseTo(1.5);
  });

  it("split sets parent layout to splitv", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    const parent = new SplitContainer("parent", Layout.SplitH);
    parent.addChild(window);

    const result = splitHandler.execute(makeCommand("splitv"), {
      root: parent as any,
      focused: window,
      adapter: makeAdapter(),
    });

    expect(result.success).toBeTrue();
    expect(parent.layout).toBe(Layout.SplitV);
  });

  it("layout switches parent layout", () => {
    const window = new WindowContainer("win", {}, 1, "app", "title");
    const parent = new SplitContainer("parent", Layout.SplitH);
    parent.addChild(window);

    const result = layoutHandler.execute(makeCommand("layout", ["stacking"]), {
      root: parent as any,
      focused: window,
      adapter: makeAdapter(),
    });

    expect(result.success).toBeTrue();
    expect(parent.layout).toBe(Layout.Stacking);
  });
});
