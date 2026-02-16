import type { ContainerJSON } from "./container.js";
import { Container, ContainerType } from "./container.js";
import type { WindowContainer } from "./window-container.js";

export interface WorkspaceJSON extends ContainerJSON {
  name: string;
  number: number;
  visible: boolean;
  urgent: boolean;
  floatingWindows: ContainerJSON[];
}

export class WorkspaceContainer extends Container {
  name: string;
  number: number;
  visible: boolean;
  urgent: boolean;
  private floatingWindows: WindowContainer[];

  constructor(id: number, name: string, number: number, visible: boolean) {
    super(id, ContainerType.Workspace);
    this.name = name;
    this.number = number;
    this.visible = visible;
    this.urgent = false;
    this.floatingWindows = [];
  }

  addFloatingWindow(window: WindowContainer): void {
    this.floatingWindows.push(window);
  }

  removeFloatingWindow(window: WindowContainer): void {
    const index = this.floatingWindows.indexOf(window);
    if (index === -1) {
      return;
    }

    this.floatingWindows.splice(index, 1);
  }

  getFloatingWindows(): WindowContainer[] {
    return [...this.floatingWindows];
  }

  tiledWindowCount(): number {
    let count = 0;

    const walk = (container: Container): void => {
      if (container.type === ContainerType.Window) {
        count += 1;
        return;
      }

      for (const child of container.children) {
        walk(child);
      }
    };

    walk(this);
    return count;
  }

  override toJSON(): WorkspaceJSON {
    return {
      ...super.toJSON(),
      name: this.name,
      number: this.number,
      visible: this.visible,
      urgent: this.urgent,
      floatingWindows: this.getFloatingWindows().map((window) => window.toJSON()),
    };
  }
}
