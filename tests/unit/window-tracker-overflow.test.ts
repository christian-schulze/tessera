import { Layout } from "../../src/tree/container.ts";
import {
  shouldFloatOnAdd,
  shouldFloatOnRetry,
} from "../../src/window-tracker-overflow.ts";

describe("window tracker overflow helpers", () => {
  it("floats SplitV when height per tile is below minTileHeight", () => {
    const workspaceRect = { x: 0, y: 0, width: 1200, height: 600 };
    const shouldFloat = shouldFloatOnAdd(
      Layout.SplitV,
      workspaceRect,
      3,
      300,
      240
    );

    expect(shouldFloat).toBe(true);
  });

  it("does not float SplitV when height per tile meets minTileHeight", () => {
    const workspaceRect = { x: 0, y: 0, width: 1200, height: 720 };
    const shouldFloat = shouldFloatOnAdd(
      Layout.SplitV,
      workspaceRect,
      3,
      300,
      240
    );

    expect(shouldFloat).toBe(false);
  });

  it("floats SplitV on retry when actual height exceeds minTileHeight", () => {
    const workspaceRect = { x: 0, y: 0, width: 1200, height: 500 };
    const actualRect = { x: 0, y: 0, width: 600, height: 300 };
    const shouldFloat = shouldFloatOnRetry(
      Layout.SplitV,
      workspaceRect,
      2,
      300,
      240,
      actualRect
    );

    expect(shouldFloat).toBe(true);
  });

  it("mirrors SplitH width overflow behavior", () => {
    const workspaceRect = { x: 0, y: 0, width: 500, height: 800 };
    const shouldFloat = shouldFloatOnAdd(
      Layout.SplitH,
      workspaceRect,
      3,
      300,
      240
    );

    expect(shouldFloat).toBe(true);
  });
});
