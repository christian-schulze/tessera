import { getLayoutStrategy } from "../../../src/layout/strategy.ts";
import { Layout } from "../../../src/tree/container.ts";
import { RootContainer } from "../../../src/tree/root-container.ts";
import { SplitContainer } from "../../../src/tree/split-container.ts";
import { WindowContainer } from "../../../src/tree/window-container.ts";

describe("getLayoutStrategy", () => {
  it("returns SplitH strategy for SplitH layout", () => {
    const strategy = getLayoutStrategy(Layout.SplitH);

    expect(strategy.id).toBe(Layout.SplitH);
  });

  it("returns SplitV strategy for SplitV layout", () => {
    const strategy = getLayoutStrategy(Layout.SplitV);

    expect(strategy.id).toBe(Layout.SplitV);
  });

  it("returns Alternating strategy for Alternating layout", () => {
    const strategy = getLayoutStrategy(Layout.Alternating);

    expect(strategy.id).toBe(Layout.Alternating);
  });

  it("alternating strategy uses horizontal base", () => {
    const root = new SplitContainer(1, Layout.Alternating);
    const winA = new WindowContainer(2, {}, 1, "app", "A");
    const winB = new WindowContainer(3, {}, 2, "app", "B");
    root.rect = { x: 0, y: 0, width: 1000, height: 800 };
    root.addChild(winA);
    root.addChild(winB);

    getLayoutStrategy(Layout.Alternating).computeRects(root);

    expect(winA.rect.height).toBe(800);
    expect(winB.rect.height).toBe(800);
    expect(winA.rect.width).toBeLessThan(winB.rect.width + 1);
  });

  it("alternating strategy uses focused target and opposite axis", () => {
    const parent = new SplitContainer(1, Layout.Alternating);
    const split = new SplitContainer(2, Layout.SplitH);
    const focused = new WindowContainer(3, {}, 1, "app", "A");
    focused.focused = true;
    split.addChild(focused);
    parent.addChild(split);

    const plan = getLayoutStrategy(Layout.Alternating).onWindowAdded?.({
      root: new RootContainer(0),
      parent,
      focused,
      mode: "focused",
    });

    expect(plan).toBeTruthy();
    expect(plan?.wrapTarget).toBe(focused);
    expect(plan?.wrapLayout).toBe(Layout.SplitV);
  });

  it("alternating strategy uses tail target and opposite axis", () => {
    const parent = new SplitContainer(1, Layout.Alternating);
    const split = new SplitContainer(2, Layout.SplitV);
    const a = new WindowContainer(3, {}, 1, "app", "A");
    const b = new WindowContainer(4, {}, 2, "app", "B");
    split.addChild(a);
    split.addChild(b);
    parent.addChild(split);

    const plan = getLayoutStrategy(Layout.Alternating).onWindowAdded?.({
      root: new RootContainer(0),
      parent,
      focused: a,
      mode: "tail",
    });

    expect(plan?.wrapTarget).toBe(b);
    expect(plan?.wrapLayout).toBe(Layout.SplitH);
  });

  it("alternating strategy tail mode uses parent tail even if focus is elsewhere", () => {
    const parent = new SplitContainer(1, Layout.Alternating);
    const left = new SplitContainer(2, Layout.SplitH);
    const right = new SplitContainer(3, Layout.SplitV);
    const focused = new WindowContainer(4, {}, 1, "app", "Focus");
    const tailA = new WindowContainer(5, {}, 2, "app", "TailA");
    const tailB = new WindowContainer(6, {}, 3, "app", "TailB");

    left.addChild(focused);
    right.addChild(tailA);
    right.addChild(tailB);
    parent.addChild(left);
    parent.addChild(right);

    const plan = getLayoutStrategy(Layout.Alternating).onWindowAdded?.({
      root: new RootContainer(0),
      parent,
      focused,
      mode: "tail",
    });

    expect(plan?.wrapTarget).toBe(tailB);
    expect(plan?.wrapLayout).toBe(Layout.SplitH);
  });
});
