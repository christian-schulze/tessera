import { getLayoutStrategy } from "../../src/layout/strategy.ts";
import { Layout } from "../../src/tree/container.ts";
import { SplitContainer } from "../../src/tree/split-container.ts";

describe("window tracker overflow helpers", () => {
  it("floats SplitH when width per tile is below minTileWidth", () => {
    const workspaceRect = { x: 0, y: 0, width: 800, height: 600 };
    const container = new SplitContainer(1, Layout.SplitH);
    const strategy = getLayoutStrategy(container);
    const shouldFloat = strategy.shouldFloatOnAdd(
      workspaceRect,
      3,
      300,
      120
    );

    expect(shouldFloat).toBe(true);
  });

  it("floats SplitV when height per tile is below minTileHeight", () => {
    const workspaceRect = { x: 0, y: 0, width: 1200, height: 600 };
    const container = new SplitContainer(1, Layout.SplitV);
    const strategy = getLayoutStrategy(container);
    const shouldFloat = strategy.shouldFloatOnAdd(
      workspaceRect,
      3,
      300,
      240
    );

    expect(shouldFloat).toBe(true);
  });

  it("floats SplitV on retry when actual height exceeds minTileHeight", () => {
    const workspaceRect = { x: 0, y: 0, width: 1200, height: 500 };
    const actualRect = { x: 0, y: 0, width: 600, height: 300 };
    const container = new SplitContainer(1, Layout.SplitV);
    const strategy = getLayoutStrategy(container);
    const shouldFloat = strategy.shouldFloatOnRetry(
      workspaceRect,
      2,
      300,
      240,
      actualRect
    );

    expect(shouldFloat).toBe(true);
  });
});
