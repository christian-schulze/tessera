import { FloatingLayer } from "../../src/tree/floating-layer.ts";

describe("FloatingLayer", () => {
  it("adds and removes windows", () => {
    const layer = new FloatingLayer();
    const a = { id: "a" };

    layer.add(a);
    expect(layer.windows).toEqual([a]);

    layer.remove(a);
    expect(layer.windows).toEqual([]);
  });

  it("topWindow returns the last window", () => {
    const layer = new FloatingLayer();
    const a = { id: "a" };
    const b = { id: "b" };

    layer.add(a);
    layer.add(b);

    expect(layer.topWindow()).toBe(b);
  });

  it("raise moves a window to the top", () => {
    const layer = new FloatingLayer();
    const a = { id: "a" };
    const b = { id: "b" };

    layer.add(a);
    layer.add(b);
    layer.raise(a);

    expect(layer.windows).toEqual([b, a]);
  });

  it("lower moves a window to the bottom", () => {
    const layer = new FloatingLayer();
    const a = { id: "a" };
    const b = { id: "b" };

    layer.add(a);
    layer.add(b);
    layer.lower(b);

    expect(layer.windows).toEqual([b, a]);
  });

  it("focus sets focusedWindow and keeps order", () => {
    const layer = new FloatingLayer();
    const a = { id: "a" };
    const b = { id: "b" };

    layer.add(a);
    layer.add(b);
    layer.focus(a);

    expect(layer.focusedWindow()).toBe(a);
    expect(layer.windows).toEqual([a, b]);
  });

  it("focusNext cycles focus", () => {
    const layer = new FloatingLayer();
    const a = { id: "a" };
    const b = { id: "b" };
    const c = { id: "c" };

    layer.add(a);
    layer.add(b);
    layer.add(c);

    expect(layer.focusNext()).toBe(a);
    expect(layer.focusNext()).toBe(b);
    expect(layer.focusNext()).toBe(c);
    expect(layer.focusNext()).toBe(a);
  });

  it("toJSON serializes windows", () => {
    const layer = new FloatingLayer();
    const a = { id: "a" };
    const b = { id: "b" };
    layer.add(a);
    layer.add(b);

    expect(layer.toJSON()).toEqual({ windows: [a, b] });
  });
});
