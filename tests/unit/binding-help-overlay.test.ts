import { computeOverlayDragPosition } from "../../src/binding-help-overlay.ts";

describe("binding help overlay drag", () => {
  it("computes drag position by subtracting drag offset from pointer", () => {
    expect(
      computeOverlayDragPosition(
        { x: 420, y: 260 },
        { x: 30, y: 20 }
      )
    ).toEqual({ x: 390, y: 240 });
  });

  it("supports negative coordinates while dragging", () => {
    expect(
      computeOverlayDragPosition(
        { x: 5, y: 5 },
        { x: 20, y: 20 }
      )
    ).toEqual({ x: -15, y: -15 });
  });
});
