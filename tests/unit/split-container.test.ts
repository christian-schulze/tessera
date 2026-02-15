import { SplitContainer } from "../../src/tree/split-container.ts";
import { ContainerType, Layout } from "../../src/tree/container.ts";

describe("SplitContainer", () => {
  it("defaults to SplitH layout", () => {
    const split = new SplitContainer(1);

    expect(split.type).toBe(ContainerType.Split);
    expect(split.layout).toBe(Layout.SplitH);
  });

  it("accepts a layout parameter", () => {
    const split = new SplitContainer(1, Layout.SplitV);

    expect(split.layout).toBe(Layout.SplitV);
  });

  it("toggles layout between SplitH and SplitV", () => {
    const split = new SplitContainer(1, Layout.SplitH);

    split.toggleLayout();
    expect(split.layout).toBe(Layout.SplitV);

    split.toggleLayout();
    expect(split.layout).toBe(Layout.SplitH);
  });
});
