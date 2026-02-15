import { RootContainer } from "../../src/tree/root-container.ts";
import { OutputContainer } from "../../src/tree/output-container.ts";
import { ContainerType } from "../../src/tree/container.ts";

describe("RootContainer", () => {
  it("initializes with Root type", () => {
    const root = new RootContainer(1);

    expect(root.type).toBe(ContainerType.Root);
  });

  it("addOutput attaches output container", () => {
    const root = new RootContainer(1);
    const output = new OutputContainer(2, 0, {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });

    root.addOutput(output);

    expect(root.children.length).toBe(1);
    expect(root.children[0]).toBe(output);
    expect(output.parent).toBe(root);
  });

  it("getOutput finds output by monitor index", () => {
    const root = new RootContainer(1);
    const first = new OutputContainer(2, 0, {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    const second = new OutputContainer(3, 1, {
      x: 1920,
      y: 0,
      width: 1920,
      height: 1080,
    });

    root.addOutput(first);
    root.addOutput(second);

    expect(root.getOutput(1)).toBe(second);
    expect(root.getOutput(2)).toBeNull();
  });
});
