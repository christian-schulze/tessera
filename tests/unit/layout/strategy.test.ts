import { getLayoutStrategy } from "../../../src/layout/strategy.ts";
import { Layout } from "../../../src/tree/container.ts";

describe("getLayoutStrategy", () => {
  it("returns SplitH strategy for SplitH layout", () => {
    const strategy = getLayoutStrategy(Layout.SplitH);

    expect(strategy.id).toBe(Layout.SplitH);
  });

  it("returns SplitV strategy for SplitV layout", () => {
    const strategy = getLayoutStrategy(Layout.SplitV);

    expect(strategy.id).toBe(Layout.SplitV);
  });
});
