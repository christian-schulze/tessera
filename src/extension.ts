import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import Meta from "gi://Meta";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import St from "gi://St";
import { TreeBuilder } from "./tree/tree-builder.js";
import type { MonitorInfo } from "./tree/tree-builder.js";
import { RootContainer } from "./tree/root-container.js";
import { ContainerType } from "./tree/container.js";
import { WindowTracker } from "./window-tracker.js";
import {
  buildCommandEngine,
  findFocusedContainer,
  registerDefaultHandlers,
} from "./commands/index.js";
import { WindowContainer } from "./tree/window-container.js";
import type { CommandServiceDeps, CommandService } from "./commands/service.js";
import { buildDefaultBindingModes } from "./bindings/defaults.js";
import { BindingManager } from "./bindings/manager.js";
import { reloadBindings } from "./bindings/reload.js";
import { buildCommandService } from "./commands/service.js";
import type { WindowAdapter } from "./commands/adapter.js";
import { IpcServer } from "./ipc/server.js";
import { buildTesseraService } from "./service/tessera.js";
import { buildMonitorInfos } from "./monitors.js";
import { buildDebugPayload } from "./ipc/debug.js";
import { DEFAULT_CONFIG, applyConfig, loadConfig, type TesseraConfig } from "./config.js";
import { FocusBorder } from "./focus-border.js";
import { appendLog } from "./logging.js";
import {
  maybeRebuildTree,
  shouldContinuePolling,
} from "./extension-rebuild.js";

appendLog("module loaded");

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
  private config: TesseraConfig = { ...DEFAULT_CONFIG };
  private bindingManager: BindingManager | null = null;
  private commandService: CommandService | null = null;
  private focusBorder: FocusBorder | null = null;

  private updateFocusBorder(): void {
    if (!this.focusBorder || !this.root) {
      return;
    }

    const focused = findFocusedContainer(this.root);
    if (focused instanceof WindowContainer) {
      const frameRect = (focused.window as Meta.Window).get_frame_rect();
      this.focusBorder.updatePosition({
        x: frameRect.x,
        y: frameRect.y,
        width: frameRect.width,
        height: frameRect.height,
      });
    } else {
      this.focusBorder.updatePosition(null);
    }
  }

  private logToFile(message: string): void {
    appendLog(message);
  }

  private rebuildTree(reason: string, monitorsOverride?: MonitorInfo[]): void {
    const builder = new TreeBuilder();
    const monitors = monitorsOverride ??
      buildMonitorInfos(Main.layoutManager, global.display);
    const workspaceManager = global.workspace_manager;
    const workspaceCount = workspaceManager?.get_n_workspaces?.() ?? 1;
    const activeWorkspaceIndex = workspaceManager?.get_active_workspace_index?.() ?? 0;
    this.lastRebuildReason = reason;
    this.lastRebuildMonitors = monitors.length;

    const root = builder.build(monitors, {
      workspaceCount,
      activeWorkspaceIndex,
      workspaceOutputs: this.config.workspaceOutputs,
    });
    const tracker = new WindowTracker(
      root,
      () => this.config,
      {
        executeForTarget: (command, target) => {
          this.commandService?.executeForTarget(command, target);
        },
        onLayoutApplied: () => {
          this.updateFocusBorder();
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this.updateFocusBorder();
            return GLib.SOURCE_REMOVE;
          });
        },
        onFocusChanged: () => {
          this.updateFocusBorder();
        },
      }
    );
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
          `attempt=${this.pollAttempts} monitors=${monitors.length} outputs=${outputs}`
        );

      if (maybeRebuildTree(outputs, monitors.length, () => this.rebuildTree("poll", monitors))) {
          appendLog("rebuildTree() called");
        this.lastPollOutputs = this.root?.children.length ?? 0;
      }

      if (hasWorkAreaMismatch) {
          appendLog("work area mismatch -> rebuildTree()");
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
            false,
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
        execCapture: (command: string) => {
          return new Promise((resolve, reject) => {
            try {
              const [ok, argv] = GLib.shell_parse_argv(command);
              if (!ok || !argv) {
                reject(new Error(`Failed to parse command: ${command}`));
                return;
              }
              const proc = new Gio.Subprocess({
                argv,
                flags:
                  Gio.SubprocessFlags.STDOUT_PIPE |
                  Gio.SubprocessFlags.STDERR_PIPE,
              });
              proc.init(null);
              proc.communicate_utf8_async(null, null, (_proc, result) => {
                try {
                  const [, stdout, stderr] = proc.communicate_utf8_finish(result);
                  const exitCode = proc.get_exit_status();
                  resolve({
                    stdout: stdout ?? "",
                    stderr: stderr ?? "",
                    exitCode,
                  });
                } catch (innerError) {
                  reject(innerError);
                }
              });
            } catch (error) {
              reject(error);
            }
          });
        },
        changeWorkspace: (index: number) => {
          const workspaceManager = global.workspace_manager;
          const workspace = workspaceManager.get_workspace_by_index(index);
          if (!workspace) {
            return;
          }
          const activation = global.get_current_time();
          workspace.activate(activation);
          const metaWorkspace = workspace as unknown as {
            list_windows: () => Meta.Window[];
          };
          const windows = metaWorkspace.list_windows();
          const focusCandidate = windows.find(
            (window) =>
              window.get_window_type() === Meta.WindowType.NORMAL &&
              !window.is_skip_taskbar()
          );
          focusCandidate?.activate(activation);
        },
        moveToWorkspace: (window: unknown, index: number, focusWorkspace: boolean) => {
          const metaWindow = window as Meta.Window;
          metaWindow.change_workspace_by_index(index, false);
          if (!focusWorkspace) {
            return;
          }
          const workspaceManager = global.workspace_manager;
          const workspace = workspaceManager.get_workspace_by_index(index);
          if (!workspace) {
            return;
          }
          workspace.activate(global.get_current_time());
        },
      };

      const engine = buildCommandEngine();
      registerDefaultHandlers(engine);
      const commandServiceDeps: CommandServiceDeps = {
        engine,
        adapter,
        getRoot: () => this.root,
        getConfig: () => this.config,
        reloadConfig: () => {
          this.config = loadConfig();
          if (this.bindingManager) {
            reloadBindings(this.bindingManager, this.config);
          }
          if (this.focusBorder) {
            this.focusBorder.updateConfig(this.config.focusedBorder);
          }
          if (typeof Main.notify === "function") {
            Main.notify("Tessera", "Configuration reloaded");
          }
        },
        onAfterExecute: () => {
          this.updateFocusBorder();
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this.updateFocusBorder();
            return GLib.SOURCE_REMOVE;
          });
        },
      };
      const commandService = buildCommandService(commandServiceDeps);
      this.commandService = commandService;

      this.bindingManager = new BindingManager({
        executeCommand: (command) => {
          commandService.execute(command);
        },
      });
      const modes = this.config.modes ?? buildDefaultBindingModes();
      for (const mode of modes) {
        this.bindingManager.addMode(mode);
      }
      commandServiceDeps.switchMode = (name: string) =>
        this.bindingManager?.switchMode(name) ?? false;
      this.bindingManager.switchMode("default");
      this.bindingManager.enable();

      this.focusBorder = new FocusBorder(this.config.focusedBorder, {
        St: St as never,
        layoutManager: Main.layoutManager as never,
      });
      this.focusBorder.enable();

      const buildDebug = () => {
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
            const metaWindow = (actor as { meta_window?: Meta.Window }).meta_window;
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
      };

      const tesseraService = buildTesseraService({
        commandService,
        getRoot: () => this.root,
        getConfig: () => this.config,
        applyConfig,
        getVersion: () => ({
          uuid: this.uuid,
          version:
            (this.metadata as { version?: unknown } | undefined)?.version ?? null,
        }),
        getDebug: buildDebug,
      });

      if (GLib.getenv("TESSERA_IPC") === "1") {
        this.ipcServer = new IpcServer();
        this.ipcServer.start(tesseraService);
      }

      (globalThis as unknown as { __tessera?: TesseraGlobal }).__tessera = {
        root: this.root as RootContainer,
        tracker: this.tracker as WindowTracker,
        tree: tesseraService.tree,
        execute: commandService.execute,
      };

      for (const cmd of this.config.exec) {
        try {
          GLib.spawn_command_line_async(cmd);
        } catch (execError) {
          this.logToFile(`startup exec failed: ${cmd}: ${execError}`);
        }
      }
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

    if (this.bindingManager) {
      this.bindingManager.disable();
      this.bindingManager = null;
    }

    if (this.focusBorder) {
      this.focusBorder.disable();
      this.focusBorder = null;
    }

    this.tracker = null;
    this.root = null;
    this.ipcServer = null;
    this.commandService = null;
    (globalThis as unknown as { __tessera?: TesseraGlobal }).__tessera =
      undefined;
  }
}
