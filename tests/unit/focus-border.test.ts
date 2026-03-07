import { attachBorderActors } from "../../src/focus-border.ts";

describe("attachBorderActors", () => {
  it("reparents border bars to the focused window actor and raises them within that actor", () => {
    const removed: Array<{ child: unknown }> = [];
    const oldParent = {
      remove_child(child: unknown) {
        removed.push({ child });
      },
    };

    const added: Array<{ child: unknown }> = [];
    const raised: Array<{ child: unknown; sibling: unknown }> = [];
    const parent = {
      add_child(child: unknown) {
        added.push({ child });
      },
      remove_child() {
        // unused in this test
      },
      set_child_above_sibling(child: unknown, sibling: unknown) {
        raised.push({ child, sibling });
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
    expect(raised).toEqual([
      { child: bars[0], sibling: null },
      { child: bars[1], sibling: null },
      { child: bars[2], sibling: null },
      { child: bars[3], sibling: null },
    ]);
  });
});
