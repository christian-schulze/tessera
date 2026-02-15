import type { OutputContainer } from "./output-container.ts";
import { Container, ContainerType } from "./container.ts";

export class RootContainer extends Container {
  constructor(id: number) {
    super(id, ContainerType.Root);
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
