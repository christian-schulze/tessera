import type { ContainerJSON, Rect } from "./container.ts";
import { Container, ContainerType } from "./container.ts";

export interface OutputJSON extends ContainerJSON {
  monitorIndex: number;
  workArea: Rect;
}

export class OutputContainer extends Container {
  monitorIndex: number;
  workArea: Rect;

  constructor(id: number, monitorIndex: number, workArea: Rect) {
    super(id, ContainerType.Output);
    this.monitorIndex = monitorIndex;
    this.workArea = { ...workArea };
  }

  updateWorkArea(workArea: Rect): void {
    this.workArea = { ...workArea };
  }

  override toJSON(): OutputJSON {
    return {
      ...super.toJSON(),
      monitorIndex: this.monitorIndex,
      workArea: { ...this.workArea },
    };
  }
}
