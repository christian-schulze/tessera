import { Container, ContainerType } from "../../src/tree/container.ts";
import { setFocusedContainer } from "../../src/tree/focus.ts";

describe("focus helpers", () => {
  it("sets focus on target and clears other containers", () => {
    const root = new Container(1, ContainerType.Root);
    const first = new Container(2, ContainerType.Window);
    const second = new Container(3, ContainerType.Window);

    root.addChild(first);
    root.addChild(second);
    first.focused = true;

    setFocusedContainer(root, second);

    expect(first.focused).toBe(false);
    expect(second.focused).toBe(true);
  });

  it("clears focus when target is null", () => {
    const root = new Container(1, ContainerType.Root);
    const child = new Container(2, ContainerType.Window);
    root.addChild(child);
    child.focused = true;

    setFocusedContainer(root, null);

    expect(child.focused).toBe(false);
  });
});
