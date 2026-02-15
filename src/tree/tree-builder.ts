import type { Rect } from "./container.js";
import { RootContainer } from "./root-container.js";
import { OutputContainer } from "./output-container.js";
import { WorkspaceContainer } from "./workspace-container.js";
import { SplitContainer } from "./split-container.js";

export interface MonitorInfo {
  index: number;
  workArea: Rect;
}

export class TreeBuilder {
  build(monitors: MonitorInfo[]): RootContainer {
    const root = new RootContainer(1);
    let nextId = 2;

    for (const monitor of monitors) {
      const output = new OutputContainer(nextId++, monitor.index, monitor.workArea);
      root.addOutput(output);

      const workspace = new WorkspaceContainer(
        nextId++,
        `${monitor.index + 1}`,
        monitor.index + 1,
        true
      );
      workspace.rect = { ...monitor.workArea };
      output.addChild(workspace);

      const split = new SplitContainer(nextId++);
      split.rect = { ...monitor.workArea };
      workspace.addChild(split);
    }

    return root;
  }
}
