import type { ContainerJSON } from "./container.ts";
import { Container, ContainerType } from "./container.ts";

export interface WorkspaceJSON extends ContainerJSON {
  name: string;
  number: number;
  visible: boolean;
  urgent: boolean;
  floatingWindows: unknown[];
}

export class WorkspaceContainer extends Container {
  name: string;
  number: number;
  visible: boolean;
  urgent: boolean;
  private floatingWindows: unknown[];

  constructor(id: number, name: string, number: number, visible: boolean) {
    super(id, ContainerType.Workspace);
    this.name = name;
    this.number = number;
    this.visible = visible;
    this.urgent = false;
    this.floatingWindows = [];
  }

  addFloatingWindow(window: unknown): void {
    this.floatingWindows.push(window);
  }

  removeFloatingWindow(window: unknown): void {
    const index = this.floatingWindows.indexOf(window);
    if (index === -1) {
      return;
    }

    this.floatingWindows.splice(index, 1);
  }

  getFloatingWindows(): unknown[] {
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
      floatingWindows: this.getFloatingWindows(),
    };
  }
}
