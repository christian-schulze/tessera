import type { Rect } from "./container.js";
import { Layout } from "./container.js";
import { RootContainer } from "./root-container.js";
import { OutputContainer } from "./output-container.js";
import { WorkspaceContainer } from "./workspace-container.js";
import { SplitContainer } from "./split-container.js";

export interface MonitorInfo {
  index: number;
  workArea: Rect;
}

export type TreeBuilderOptions = {
  workspaceCount?: number;
  activeWorkspaceIndex?: number;
};

export class TreeBuilder {
  private toRect(rect: Rect): Rect {
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  build(monitors: MonitorInfo[], options: TreeBuilderOptions = {}): RootContainer {
    const root = new RootContainer(1);
    const workspaceCount = options.workspaceCount ?? 1;
    const activeWorkspaceIndex = options.activeWorkspaceIndex ?? 0;

    for (const monitor of monitors) {
      const workArea = this.toRect(monitor.workArea);
      const output = new OutputContainer(root.nextId(), monitor.index, workArea);
      root.addOutput(output);

      for (let index = 0; index < workspaceCount; index += 1) {
        const workspaceNumber = index + 1;
        const workspace = new WorkspaceContainer(
          root.nextId(),
          String(workspaceNumber),
          workspaceNumber,
          index === activeWorkspaceIndex
        );
        workspace.rect = this.toRect(workArea);
        output.addChild(workspace);

        const split = new SplitContainer(root.nextId(), Layout.Alternating);
        split.rect = this.toRect(workArea);
        workspace.addChild(split);
      }
    }

    return root;
  }
}
