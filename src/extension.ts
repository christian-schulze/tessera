import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import Meta from "gi://Meta";
import GLib from "gi://GLib";
import { TreeBuilder } from "./tree/tree-builder.js";
import type { MonitorInfo } from "./tree/tree-builder.js";
import { RootContainer } from "./tree/root-container.js";
import { ContainerType } from "./tree/container.js";
import { WindowTracker } from "./window-tracker.js";
import { parseCommandString } from "./commands/parser.js";
import { buildCommandEngine, findFocusedContainer, registerDefaultHandlers } from "./commands/index.js";
import type { WindowAdapter } from "./commands/adapter.js";
import { IpcServer } from "./ipc/server.js";
import { buildMonitorInfos } from "./monitors.js";
import { buildDebugPayload } from "./ipc/debug.js";
import { applyConfig, loadConfig, type TesseraConfig } from "./config.js";
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
  private config: TesseraConfig = { minTileWidth: 300 };

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

  private rebuildTree(reason: string, monitorsOverride?: MonitorInfo[]): void {
    const builder = new TreeBuilder();
    const monitors = monitorsOverride ??
      buildMonitorInfos(Main.layoutManager, global.display);
    this.lastRebuildReason = reason;
    this.lastRebuildMonitors = monitors.length;

    const root = builder.build(monitors);
    const tracker = new WindowTracker(root, () => this.config);
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
      const hasWorkAreaMismatch = (() => {
        if (!this.root || monitors.length === 0) {
          return false;
        }

        for (const monitor of monitors) {
          const output = this.root.getOutput(monitor.index);
          if (!output) {
            return true;
          }

          const workArea = monitor.workArea;
          const outputArea = output.workArea;
          if (
            outputArea.x !== workArea.x ||
            outputArea.y !== workArea.y ||
            outputArea.width !== workArea.width ||
            outputArea.height !== workArea.height
          ) {
            return true;
          }

          const workspace = output.children.find(
            (child) => child.type === ContainerType.Workspace
          );
          if (workspace && (
            workspace.rect.x !== workArea.x ||
            workspace.rect.y !== workArea.y ||
            workspace.rect.width !== workArea.width ||
            workspace.rect.height !== workArea.height
          )) {
            return true;
          }
        }

        return false;
      })();

      this.lastPollMonitors = monitors.length;
      this.lastPollOutputs = outputs;

      appendLog(
        "/tmp/tessera-monitor.log",
        `attempt=${this.pollAttempts} monitors=${monitors.length} outputs=${outputs}`
      );

      if (maybeRebuildTree(outputs, monitors.length, () => this.rebuildTree("poll", monitors))) {
        appendLog("/tmp/tessera-monitor.log", "rebuildTree() called");
        this.lastPollOutputs = this.root?.children.length ?? 0;
      }

      if (hasWorkAreaMismatch) {
        appendLog("/tmp/tessera-monitor.log", "work area mismatch -> rebuildTree()");
        this.rebuildTree("workarea", monitors);
      }

      const hasOutputs = (this.root?.children.length ?? 0) > 0;
      const shouldContinue =
        hasWorkAreaMismatch ||
        shouldContinuePolling(this.pollAttempts, maxAttempts, hasOutputs ? 1 : 0);
      if (!shouldContinue) {
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
      this.config = loadConfig();
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
            const windowActors = global.get_window_actors?.() ?? [];
            const windows = windowActors
              .map((actor) => {
                const metaWindow = (actor as { meta_window?: Meta.Window })
                  .meta_window;
                if (!metaWindow) {
                  return null;
                }
                const frameRect = metaWindow.get_frame_rect();
                const minSize = (metaWindow as unknown as {
                  get_min_size?: () => [number, number];
                }).get_min_size?.();
                const minWidth = minSize?.[0] ?? 0;
                const minHeight = minSize?.[1] ?? 0;
                return {
                  id: metaWindow.get_id(),
                  title: metaWindow.get_title(),
                  wmClass: metaWindow.get_wm_class?.() ?? null,
                  type: metaWindow.get_window_type(),
                  maximized: metaWindow.is_maximized?.() ?? false,
                  frameRect: {
                    x: frameRect.x,
                    y: frameRect.y,
                    width: frameRect.width,
                    height: frameRect.height,
                  },
                  minWidth,
                  minHeight,
                  canMove: metaWindow.allows_move(),
                  canResize: metaWindow.allows_resize(),
                };
              })
              .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

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
              windows,
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
          config: (params) => {
            if (params) {
              applyConfig(this.config, params);
            }
            return { ...this.config };
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
