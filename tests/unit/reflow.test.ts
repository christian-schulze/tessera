import { reflow } from "../../src/tree/reflow.ts";
import { SplitContainer } from "../../src/tree/split-container.ts";
import { WorkspaceContainer } from "../../src/tree/workspace-container.ts";
import { Container, ContainerType, Layout } from "../../src/tree/container.ts";

let nextId = 1;

function makeWindow() {
  nextId += 1;
  return new Container(nextId, ContainerType.Window);
}

describe("reflow", () => {
  beforeEach(() => {
    nextId = 1;
  });

  it("gives a single child the full rect", () => {
    const split = new SplitContainer(1, Layout.SplitH);
    split.rect = { x: 0, y: 0, width: 1920, height: 1080 };
    const win = makeWindow();
    split.addChild(win);

    reflow(split);

    expect(win.rect).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("splits horizontally with equal proportions", () => {
    const split = new SplitContainer(1, Layout.SplitH);
    split.rect = { x: 0, y: 0, width: 1920, height: 1080 };
    const a = makeWindow();
    const b = makeWindow();
    split.addChild(a);
    split.addChild(b);

    reflow(split);

    expect(a.rect).toEqual({ x: 0, y: 0, width: 960, height: 1080 });
    expect(b.rect).toEqual({ x: 960, y: 0, width: 960, height: 1080 });
  });

  it("splits vertically with equal proportions", () => {
    const split = new SplitContainer(1, Layout.SplitV);
    split.rect = { x: 0, y: 0, width: 1920, height: 1080 };
    const a = makeWindow();
    const b = makeWindow();
    split.addChild(a);
    split.addChild(b);

    reflow(split);

    expect(a.rect).toEqual({ x: 0, y: 0, width: 1920, height: 540 });
    expect(b.rect).toEqual({ x: 0, y: 540, width: 1920, height: 540 });
  });

  it("respects custom proportions", () => {
    const split = new SplitContainer(1, Layout.SplitH);
    split.rect = { x: 0, y: 0, width: 1000, height: 500 };
    const a = makeWindow();
    const b = makeWindow();
    a.proportion = 2;
    b.proportion = 1;
    split.addChild(a);
    split.addChild(b);

    reflow(split);

    expect(a.rect.width + b.rect.width).toBe(1000);
    expect(a.rect.width).toBeGreaterThan(b.rect.width);
  });

  it("handles three children horizontally", () => {
    const split = new SplitContainer(1, Layout.SplitH);
    split.rect = { x: 0, y: 0, width: 900, height: 600 };
    const a = makeWindow();
    const b = makeWindow();
    const c = makeWindow();
    split.addChild(a);
    split.addChild(b);
    split.addChild(c);

    reflow(split);

    expect(a.rect).toEqual({ x: 0, y: 0, width: 300, height: 600 });
    expect(b.rect).toEqual({ x: 300, y: 0, width: 300, height: 600 });
    expect(c.rect).toEqual({ x: 600, y: 0, width: 300, height: 600 });
  });

  it("reflows nested splits recursively", () => {
    const outer = new SplitContainer(1, Layout.SplitH);
    outer.rect = { x: 0, y: 0, width: 1000, height: 500 };
    const left = makeWindow();
    const right = new SplitContainer(2, Layout.SplitV);
    outer.addChild(left);
    outer.addChild(right);
    const topRight = makeWindow();
    const bottomRight = makeWindow();
    right.addChild(topRight);
    right.addChild(bottomRight);

    reflow(outer);

    expect(left.rect).toEqual({ x: 0, y: 0, width: 500, height: 500 });
    expect(right.rect).toEqual({ x: 500, y: 0, width: 500, height: 500 });
    expect(topRight.rect).toEqual({ x: 500, y: 0, width: 500, height: 250 });
    expect(bottomRight.rect).toEqual({ x: 500, y: 250, width: 500, height: 250 });
  });

  it("handles empty containers", () => {
    const split = new SplitContainer(1, Layout.SplitH);
    split.rect = { x: 0, y: 0, width: 1920, height: 1080 };

    reflow(split);
  });

  it("applies inner gaps when provided", () => {
    const split = new SplitContainer(1, Layout.SplitH);
    split.rect = { x: 0, y: 0, width: 1000, height: 500 };
    const a = makeWindow();
    const b = makeWindow();
    split.addChild(a);
    split.addChild(b);

    reflow(split, { inner: 10, outer: 0 });

    expect(a.rect.width).toBe(495);
    expect(b.rect.width).toBe(495);
    expect(b.rect.x).toBe(505);
  });

  it("applies outer gaps when split is a workspace child", () => {
    const workspace = new WorkspaceContainer(1, "1", 1, true);
    workspace.rect = { x: 0, y: 0, width: 1000, height: 500 };
    const split = new SplitContainer(2, Layout.SplitH);
    split.rect = { ...workspace.rect };
    workspace.addChild(split);
    const a = makeWindow();
    const b = makeWindow();
    split.addChild(a);
    split.addChild(b);

    reflow(split, { inner: 0, outer: 20 });

    // Outer gap of 20 shrinks the available area to 960×460 starting at (20,20)
    expect(a.rect.x).toBe(20);
    expect(a.rect.y).toBe(20);
    expect(a.rect.width).toBe(480);
    expect(a.rect.height).toBe(460);
    expect(b.rect.x).toBe(500);
    expect(b.rect.width).toBe(480);
  });

  it("normalizes empty split chains after removal", async () => {
    const module = await import("../../src/tree/reflow.ts");

    const workspace = new WorkspaceContainer(1, "1", 1, true);
    const alternating = new SplitContainer(2, Layout.SplitH);
    alternating.alternating = true;
    workspace.addChild(alternating);
    const splitH = new SplitContainer(3, Layout.SplitH);
    alternating.addChild(splitH);
    const window = makeWindow();
    const emptySplit = new SplitContainer(5, Layout.SplitV);
    splitH.addChild(window);
    splitH.addChild(emptySplit);

    module.normalizeTree(splitH);

    expect(workspace.children.length).toBe(1);
    expect(workspace.children[0]).toBe(alternating);
    expect(alternating.children.length).toBe(1);
    expect(alternating.children[0]).toBe(window);
  });

  it("keeps workspace split when all tiles removed", async () => {
    const module = await import("../../src/tree/reflow.ts");

    const workspace = new WorkspaceContainer(1, "1", 1, true);
    const alternating = new SplitContainer(2, Layout.SplitH);
    alternating.alternating = true;
    workspace.addChild(alternating);
    const splitH = new SplitContainer(3, Layout.SplitH);
    const emptySplit = new SplitContainer(4, Layout.SplitV);
    alternating.addChild(splitH);
    splitH.addChild(emptySplit);

    module.normalizeTree(splitH);

    expect(workspace.children.length).toBe(1);
    expect(workspace.children[0]).toBe(alternating);
    expect(alternating.children.length).toBe(0);
  });
});
