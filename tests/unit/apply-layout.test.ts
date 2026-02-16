import { applyLayout } from "../../src/tree/apply-layout.ts";
import { SplitContainer } from "../../src/tree/split-container.ts";
import { WindowContainer } from "../../src/tree/window-container.ts";

describe("applyLayout", () => {
  it("moves and resizes windows based on rects", () => {
    const windowA = {};
    const windowB = {};

    const split = new SplitContainer("split");
    const containerA = new WindowContainer("win-a", windowA, 1, "app-a", "A");
    const containerB = new WindowContainer("win-b", windowB, 2, "app-b", "B");

    containerA.rect = { x: 0, y: 0, width: 200, height: 100 };
    containerB.rect = { x: 200, y: 0, width: 200, height: 100 };

    split.addChild(containerA);
    split.addChild(containerB);

    const moves: Array<{ window: unknown; rect: typeof containerA.rect }> = [];
    const adapter = {
      activate: () => {},
      moveResize: (window: unknown, rect: typeof containerA.rect) => {
        moves.push({ window, rect });
      },
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
    };

    applyLayout(split, adapter);

    expect(moves).toEqual([
      { window: windowA, rect: containerA.rect },
      { window: windowB, rect: containerB.rect },
    ]);
  });
});
