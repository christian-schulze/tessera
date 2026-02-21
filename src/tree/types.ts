export enum ContainerType {
  Root = "root",
  Output = "output",
  Workspace = "workspace",
  Split = "split",
  Window = "window",
}

export enum Layout {
  SplitH = "splith",
  SplitV = "splitv",
  Stacking = "stacking",
  Tabbed = "tabbed",
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContainerJSON {
  id: number;
  type: ContainerType;
  layout: Layout;
  alternating: boolean;
  rect: Rect;
  focused: boolean;
  marks: string[];
  proportion: number;
  children: ContainerJSON[];
}
