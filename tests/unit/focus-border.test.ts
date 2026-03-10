import {
  attachBorderActors,
  raiseBorderActorsAboveSibling,
} from "../../src/focus-border.ts";

describe("attachBorderActors", () => {
  it("reparents border bars to a stable parent", () => {
    const removed: Array<{ child: unknown }> = [];
    const oldParent = {
      remove_child(child: unknown) {
        removed.push({ child });
      },
    };

    const added: Array<{ child: unknown }> = [];
    const parent = {
      add_child(child: unknown) {
        added.push({ child });
      },
      remove_child() {
        // unused in this test
      },
      set_child_above_sibling() {
        // unused in this test
      },
    };

    const bars = [
      { id: "top", get_parent: () => oldParent },
      { id: "bottom", get_parent: () => oldParent },
      { id: "left", get_parent: () => oldParent },
      { id: "right", get_parent: () => oldParent },
    ];

    attachBorderActors(parent as never, bars as never);

    expect(removed).toEqual([
      { child: bars[0] },
      { child: bars[1] },
      { child: bars[2] },
      { child: bars[3] },
    ]);
    expect(added).toEqual([
      { child: bars[0] },
      { child: bars[1] },
      { child: bars[2] },
      { child: bars[3] },
    ]);
  });
});

describe("raiseBorderActorsAboveSibling", () => {
  it("raises border bars just above the focused window actor", () => {
    const raised: Array<{ child: unknown; sibling: unknown }> = [];
    const parent = {
      add_child() {
        // unused in this test
      },
      remove_child() {
        // unused in this test
      },
      set_child_above_sibling(child: unknown, sibling: unknown) {
        raised.push({ child, sibling });
      },
    };
    const focusedActor = { id: "focused-window" };
    const bars = [
      { id: "top" },
      { id: "bottom" },
      { id: "left" },
      { id: "right" },
    ];

    raiseBorderActorsAboveSibling(parent as never, bars as never, focusedActor as never);

    expect(raised).toEqual([
      { child: bars[0], sibling: focusedActor },
      { child: bars[1], sibling: focusedActor },
      { child: bars[2], sibling: focusedActor },
      { child: bars[3], sibling: focusedActor },
    ]);
  });
});
