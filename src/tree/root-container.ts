import type { OutputContainer } from "./output-container.js";
import { Container, ContainerType } from "./container.js";

export class RootContainer extends Container {
  private nextContainerId: number;

  constructor(id: number) {
    super(id, ContainerType.Root);
    this.nextContainerId = id + 1;
  }

  nextId(): number {
    const nextId = this.nextContainerId;
    this.nextContainerId += 1;
    return nextId;
  }

  addOutput(output: OutputContainer): void {
    this.addChild(output);
  }

  getOutput(monitorIndex: number): OutputContainer | null {
    return (
      this.children.find(
        (child) =>
          child.type === ContainerType.Output &&
          (child as OutputContainer).monitorIndex === monitorIndex
      ) as OutputContainer | undefined
    ) ?? null;
  }
}
