import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import Meta from "gi://Meta";
import GLib from "gi://GLib";
import { TreeBuilder } from "./tree/tree-builder.js";
import { RootContainer } from "./tree/root-container.js";
import { WindowTracker } from "./window-tracker.js";
import { parseCommandString } from "./commands/parser.js";
import { buildCommandEngine, findFocusedContainer, registerDefaultHandlers } from "./commands/index.js";
import type { WindowAdapter } from "./commands/adapter.js";

type TesseraGlobal = {
  root: RootContainer;
  tracker: WindowTracker;
  tree: () => unknown;
  execute: (command: string) => unknown;
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

    const adapter: WindowAdapter = {
      activate: (window: unknown) => (window as Meta.Window).activate(global.get_current_time()),
      moveResize: (window: unknown, rect) =>
        (window as Meta.Window).move_resize_frame(
          true,
          rect.x,
          rect.y,
          rect.width,
          rect.height
        ),
      setFullscreen: (window: unknown, fullscreen: boolean) => {
        if (fullscreen) {
          (window as Meta.Window).make_fullscreen();
        } else {
          (window as Meta.Window).unmake_fullscreen();
        }
      },
      setFloating: (window: unknown, floating: boolean) => {
        const metaWindow = window as Meta.Window;
        if (floating) {
          metaWindow.make_above();
        } else {
          metaWindow.unmake_above();
        }
      },
      close: (window: unknown) => (window as Meta.Window).delete(global.get_current_time()),
      exec: (command: string) => GLib.spawn_command_line_async(command),
    };

    const engine = buildCommandEngine();
    registerDefaultHandlers(engine);

    (globalThis as unknown as { __tessera?: TesseraGlobal }).__tessera = {
      root: this.root,
      tracker: this.tracker,
      tree: () => this.root?.toJSON(),
      execute: (command: string) => {
        if (!this.root) {
          return [{ success: false, message: "Root container is not ready" }];
        }

        const commands = parseCommandString(command);
        const focused = findFocusedContainer(this.root);
        return engine.executeBatch(commands, {
          root: this.root,
          focused,
          adapter,
        });
      },
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
