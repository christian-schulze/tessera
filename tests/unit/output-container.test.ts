import { OutputContainer } from "../../src/tree/output-container.ts";
import { ContainerType } from "../../src/tree/container.ts";

describe("OutputContainer", () => {
  it("initializes with Output type and monitor info", () => {
    const output = new OutputContainer(1, 2, {
      x: 10,
      y: 20,
      width: 800,
      height: 600,
    });

    expect(output.type).toBe(ContainerType.Output);
    expect(output.monitorIndex).toBe(2);
    expect(output.workArea).toEqual({ x: 10, y: 20, width: 800, height: 600 });
  });

  it("updateWorkArea replaces the work area", () => {
    const output = new OutputContainer(1, 0, {
      x: 0,
      y: 0,
      width: 1024,
      height: 768,
    });

    output.updateWorkArea({ x: 5, y: 5, width: 1280, height: 720 });

    expect(output.workArea).toEqual({ x: 5, y: 5, width: 1280, height: 720 });
  });

  it("toJSON includes output metadata", () => {
    const output = new OutputContainer(1, 0, {
      x: 0,
      y: 0,
      width: 1024,
      height: 768,
    });

    const json = output.toJSON();

    expect(json).toEqual({
      id: 1,
      type: ContainerType.Output,
      layout: output.layout,
      alternating: false,
      rect: output.rect,
      focused: false,
      marks: [],
      proportion: 1,
      children: [],
      monitorIndex: 0,
      workArea: { x: 0, y: 0, width: 1024, height: 768 },
    });
  });
});
