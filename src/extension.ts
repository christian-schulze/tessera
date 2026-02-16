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
import { IpcServer } from "./ipc/server.js";
import { buildMonitorInfos } from "./monitors.js";
import { buildDebugPayload } from "./ipc/debug.js";
import {
  maybeRebuildTree,
  shouldContinuePolling,
} from "./extension-rebuild.js";

const appendLog = (path: string, message: string): void => {
  try {
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    const existing = GLib.file_get_contents(path)[1]?.toString() ?? "";
    GLib.file_set_contents(path, existing + entry);
  } catch {
    // ignore logging failures
  }
};

appendLog("/tmp/tessera-load.log", "module loaded");

type TesseraGlobal = {
  root: RootContainer;
  tracker: WindowTracker;
  tree: () => unknown;
  execute: (command: string) => unknown;
};

export default class TesseraExtension extends Extension {
  private root: RootContainer | null = null;
  private tracker: WindowTracker | null = null;
  private ipcServer: IpcServer | null = null;
  private monitorTimeout: number | null = null;
  private rebuildCount = 0;
  private lastRebuildReason = "";
  private lastRebuildMonitors = 0;
  private lastRebuildOutputs = 0;
  private pollAttempts = 0;
  private lastPollMonitors = 0;
  private lastPollOutputs = 0;
  private pollingActive = false;

  private logToFile(message: string): void {
    const path = "/tmp/tessera-enable.log";
    try {
      const entry = `[${new Date().toISOString()}] ${message}\n`;
      const existing = GLib.file_get_contents(path)[1]?.toString() ?? "";
      GLib.file_set_contents(path, existing + entry);
    } catch {
      // ignore logging failures
    }
  }

  private rebuildTree(reason: string): void {
    const builder = new TreeBuilder();
    const monitors = buildMonitorInfos(Main.layoutManager, global.display);
    this.lastRebuildReason = reason;
    this.lastRebuildMonitors = monitors.length;

    const root = builder.build(monitors);
    const tracker = new WindowTracker(root);
    tracker.start();

    if (this.tracker) {
      this.tracker.stop();
    }

    this.root = root;
    this.tracker = tracker;
    this.lastRebuildOutputs = root.children.length;
    this.rebuildCount += 1;

    const globalTessera = (globalThis as unknown as { __tessera?: TesseraGlobal })
      .__tessera;
    if (globalTessera) {
      globalTessera.root = root;
      globalTessera.tracker = tracker;
    }
  }

  private ensureMonitorsReady(): void {
    if (this.monitorTimeout !== null) {
      return;
    }

    this.pollingActive = true;
    const maxAttempts = 120;
    this.monitorTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
      this.pollAttempts += 1;
      const monitors = buildMonitorInfos(Main.layoutManager, global.display);
      const outputs = this.root?.children.length ?? 0;

      this.lastPollMonitors = monitors.length;
      this.lastPollOutputs = outputs;

      appendLog(
        "/tmp/tessera-monitor.log",
        `attempt=${this.pollAttempts} monitors=${monitors.length} outputs=${outputs}`
      );

      if (maybeRebuildTree(outputs, monitors.length, () => this.rebuildTree("poll"))) {
        appendLog("/tmp/tessera-monitor.log", "rebuildTree() called");
        this.lastPollOutputs = this.root?.children.length ?? 0;
      }

      const hasOutputs = (this.root?.children.length ?? 0) > 0;
      if (!shouldContinuePolling(this.pollAttempts, maxAttempts, hasOutputs ? 1 : 0)) {
        this.monitorTimeout = null;
        this.pollingActive = false;
        return GLib.SOURCE_REMOVE;
      }

      return GLib.SOURCE_CONTINUE;
    });
  }

  enable(): void {
    try {
      this.logToFile("enable start");
      this.rebuildTree("initial");
      GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        this.rebuildTree("idle");
        return GLib.SOURCE_REMOVE;
      });
      this.ensureMonitorsReady();

      const adapter: WindowAdapter = {
        activate: (window: unknown) =>
          (window as Meta.Window).activate(global.get_current_time()),
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
        close: (window: unknown) =>
          (window as Meta.Window).delete(global.get_current_time()),
        exec: (command: string) => GLib.spawn_command_line_async(command),
      };

      const engine = buildCommandEngine();
      registerDefaultHandlers(engine);

      const executeCommand = (command: string) => {
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
      };

      if (GLib.getenv("TESSERA_IPC") === "1") {
        this.ipcServer = new IpcServer();
        this.ipcServer.start({
          execute: executeCommand,
          tree: () => this.root?.toJSON(),
          ping: () => ({ ok: true }),
          version: () => ({
            uuid: this.uuid,
            version:
              (this.metadata as { version?: unknown } | undefined)?.version ?? null,
          }),
          debug: () => {
            const monitorInfos = buildMonitorInfos(Main.layoutManager, global.display);
            const workAreas = monitorInfos.map((monitor) => ({
              x: monitor.workArea.x,
              y: monitor.workArea.y,
              width: monitor.workArea.width,
              height: monitor.workArea.height,
            }));
            const glib = GLib as unknown as {
              getpid?: () => number;
              get_pid?: () => number;
            };
            const pid = glib.getpid?.() ?? glib.get_pid?.() ?? 0;

            return buildDebugPayload({
              root: this.root,
              monitors: {
                layoutManagerCount: Main.layoutManager.monitors.length,
                displayCount: global.display.get_n_monitors?.() ?? 0,
                workAreas,
              },
              ipc: {
                socketPath: this.ipcServer?.getSocketPath() ?? null,
                pid,
              },
              extension: {
                rebuildCount: this.rebuildCount,
                lastRebuildReason: this.lastRebuildReason,
                lastRebuildMonitors: this.lastRebuildMonitors,
                lastRebuildOutputs: this.lastRebuildOutputs,
                pollAttempts: this.pollAttempts,
                lastPollMonitors: this.lastPollMonitors,
                lastPollOutputs: this.lastPollOutputs,
                pollingActive: this.pollingActive,
              },
              version: {
                uuid: this.uuid,
                version: (() => {
                  const value =
                    (this.metadata as { version?: unknown } | undefined)?.version ??
                    null;
                  return typeof value === "string" ? value : null;
                })(),
              },
            });
          },
        });
      }

      (globalThis as unknown as { __tessera?: TesseraGlobal }).__tessera = {
        root: this.root as RootContainer,
        tracker: this.tracker as WindowTracker,
        tree: () => this.root?.toJSON(),
        execute: executeCommand,
      };
    } catch (error) {
      const errorText =
        error instanceof Error
          ? error.stack ?? error.message
          : String(error);
      this.logToFile(`enable failed: ${errorText}`);
      logError(error as Error, "[tessera] enable failed");
      throw error;
    }
  }

  disable(): void {
    if (this.tracker) {
      this.tracker.stop();
    }

    if (this.ipcServer) {
      this.ipcServer.stop();
    }

    if (this.monitorTimeout !== null) {
      GLib.source_remove(this.monitorTimeout);
      this.monitorTimeout = null;
    }
    this.pollingActive = false;


    this.tracker = null;
    this.root = null;
    this.ipcServer = null;
    (globalThis as unknown as { __tessera?: TesseraGlobal }).__tessera =
      undefined;
  }
}
