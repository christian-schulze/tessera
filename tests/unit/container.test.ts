import { Container, ContainerType, Layout } from "../../src/tree/container.ts";

describe("Container", () => {
  it("addChild sets parent and appends to children", () => {
    const parent = new Container(1, ContainerType.Root);
    const child = new Container(2, ContainerType.Window);

    parent.addChild(child);

    expect(parent.children.length).toBe(1);
    expect(parent.children[0]).toBe(child);
    expect(child.parent).toBe(parent);
  });

  it("removeChild detaches parent and removes from children", () => {
    const parent = new Container(1, ContainerType.Root);
    const child = new Container(2, ContainerType.Window);

    parent.addChild(child);
    parent.removeChild(child);

    expect(parent.children.length).toBe(0);
    expect(child.parent).toBeNull();
  });

  it("setLayout updates layout", () => {
    const container = new Container(1, ContainerType.Workspace);

    container.setLayout(Layout.Stacking);

    expect(container.layout).toBe(Layout.Stacking);
  });

  it("focusedChild returns the focused child", () => {
    const parent = new Container(1, ContainerType.Workspace);
    const first = new Container(2, ContainerType.Window);
    const second = new Container(3, ContainerType.Window);

    parent.addChild(first);
    parent.addChild(second);
    second.focused = true;

    expect(parent.focusedChild()).toBe(second);
  });

  it("findByMark returns a marked descendant", () => {
    const parent = new Container(1, ContainerType.Root);
    const child = new Container(2, ContainerType.Window);
    child.marks.add("active");

    parent.addChild(child);

    expect(parent.findByMark("active")).toBe(child);
  });

  it("toJSON serializes container metadata", () => {
    const parent = new Container(1, ContainerType.Root);
    const child = new Container(2, ContainerType.Window);
    parent.rect = { x: 0, y: 0, width: 100, height: 200 };
    parent.focused = true;
    parent.proportion = 0.6;
    parent.marks.add("root");
    parent.addChild(child);

    const json = parent.toJSON();

    expect(json).toEqual({
      id: 1,
      type: ContainerType.Root,
      layout: Layout.SplitH,
      rect: { x: 0, y: 0, width: 100, height: 200 },
      focused: true,
      marks: ["root"],
      proportion: 0.6,
      children: [
        {
          id: 2,
          type: ContainerType.Window,
          layout: Layout.SplitH,
          rect: { x: 0, y: 0, width: 0, height: 0 },
          focused: false,
          marks: [],
          proportion: 1,
          children: [],
        },
      ],
    });
  });

});
