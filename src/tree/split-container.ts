import { Container, ContainerType, Layout } from "./container.js";

export class SplitContainer extends Container {
  constructor(id: number, layout: Layout = Layout.SplitH) {
    super(id, ContainerType.Split);
    this.layout = layout;
  }

  toggleLayout(): void {
    this.layout = this.layout === Layout.SplitH ? Layout.SplitV : Layout.SplitH;
  }
}
