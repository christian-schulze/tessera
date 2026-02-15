import type { ContainerJSON, Rect } from "./types.js";
import { ContainerType, Layout } from "./types.js";

export { ContainerType, Layout } from "./types.js";
export type { Rect, ContainerJSON } from "./types.js";

export class Container {
  id: number;
  type: ContainerType;
  parent: Container | null;
  children: Container[];
  layout: Layout;
  rect: Rect;
  focused: boolean;
  proportion: number;
  marks: Set<string>;

  constructor(id: number, type: ContainerType) {
    this.id = id;
    this.type = type;
    this.parent = null;
    this.children = [];
    this.layout = Layout.SplitH;
    this.rect = { x: 0, y: 0, width: 0, height: 0 };
    this.focused = false;
    this.proportion = 1;
    this.marks = new Set();
  }

  addChild(child: Container): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }

    this.children.push(child);
    child.parent = this;
  }

  removeChild(child: Container): void {
    const index = this.children.indexOf(child);
    if (index === -1) {
      return;
    }

    this.children.splice(index, 1);
    child.parent = null;
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
  }

  focusedChild(): Container | null {
    return this.children.find((child) => child.focused) ?? null;
  }

  findByMark(mark: string): Container | null {
    if (this.marks.has(mark)) {
      return this;
    }

    for (const child of this.children) {
      const match = child.findByMark(mark);
      if (match) {
        return match;
      }
    }

    return null;
  }

  toJSON(): ContainerJSON {
    return {
      id: this.id,
      type: this.type,
      layout: this.layout,
      rect: { ...this.rect },
      focused: this.focused,
      marks: Array.from(this.marks),
      proportion: this.proportion,
      children: this.children.map((child) => child.toJSON()),
    };
  }
}
