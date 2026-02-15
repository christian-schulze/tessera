import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { TreeBuilder } from "./tree/tree-builder.js";
import { RootContainer } from "./tree/root-container.js";
import { WindowTracker } from "./window-tracker.js";

type TesseraGlobal = {
  root: RootContainer;
  tracker: WindowTracker;
  tree: () => unknown;
};

export default class TesseraExtension extends Extension {
  private root: RootContainer | null = null;
  private tracker: WindowTracker | null = null;

  enable(): void {
    const builder = new TreeBuilder();
    const monitors = Main.layoutManager.monitors.map((monitor, index) => ({
      index,
      workArea: Main.layoutManager.getWorkAreaForMonitor(index),
    }));

    this.root = builder.build(monitors);
    this.tracker = new WindowTracker(this.root);
    this.tracker.start();

    (globalThis as unknown as { __tessera?: TesseraGlobal }).__tessera = {
      root: this.root,
      tracker: this.tracker,
      tree: () => this.root?.toJSON(),
    };
  }

  disable(): void {
    if (this.tracker) {
      this.tracker.stop();
    }

    this.tracker = null;
    this.root = null;
    (globalThis as unknown as { __tessera?: TesseraGlobal }).__tessera =
      undefined;
  }
}
