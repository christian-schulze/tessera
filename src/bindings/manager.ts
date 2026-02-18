import GLib from "gi://GLib";
import Meta from "gi://Meta";
import Shell from "gi://Shell";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { appendLog } from "../logging.js";
import type { Binding, BindingMode } from "./mode.js";

type Display = {
  grab_accelerator: (accelerator: string, flags: number) => number;
  ungrab_accelerator: (action: number) => void;
  connect: (
    signal: string,
    callback: (display: unknown, action: number, deviceId: number, timestamp: number) => void
  ) => number;
  disconnect: (id: number) => void;
};

type BindingEntry = {
  binding: Binding;
  key: string;
  name: string;
};

type BindingManagerDeps = {
  executeCommand: (command: string) => void;
  display?: Display;
  notify?: (message: string) => void;
};

export class BindingManager {
  private readonly display: Display;
  private readonly executeCommand: (command: string) => void;
  private readonly notify: (message: string) => void;
  private modes = new Map<string, BindingMode>();
  private activeMode: string | null = null;
  private enabled = false;
  private activeBindings = new Map<number, BindingEntry>();
  private signalId: number | null = null;

  constructor({ executeCommand, display, notify }: BindingManagerDeps) {
    this.display = display ?? (global as unknown as { display: Display }).display;
    this.executeCommand = executeCommand;
    this.notify =
      notify ??
      ((message: string) => {
        if (typeof Main.notify === "function") {
          Main.notify("Tessera", message);
          return;
        }
        appendLog(`notification unavailable: ${message}`);
      });
  }

  addMode(mode: BindingMode): void {
    this.modes.set(mode.name, mode);
    if (!this.activeMode) {
      this.activeMode = mode.name;
    }
  }

  getActiveMode(): string | null {
    return this.activeMode;
  }

  enable(): void {
    if (this.enabled) {
      return;
    }

    this.enabled = true;
    this.connectSignals();
    if (this.activeMode) {
      this.registerMode(this.activeMode);
    }
  }

  disable(): void {
    if (!this.enabled) {
      return;
    }

    this.enabled = false;
    this.unregisterAll();
    if (this.signalId !== null) {
      this.display.disconnect(this.signalId);
      this.signalId = null;
    }
  }

  switchMode(name: string): boolean {
    if (!this.modes.has(name)) {
      appendLog(`binding mode not found: ${name}`);
      return false;
    }

    this.activeMode = name;
    if (!this.enabled) {
      return true;
    }

    this.unregisterAll();
    this.registerMode(name);
    return true;
  }

  private connectSignals(): void {
    if (this.signalId !== null) {
      return;
    }

    this.signalId = this.display.connect(
      "accelerator-activated",
      (_display, action) => {
        const entry = this.activeBindings.get(action);
        if (!entry) {
          appendLog(`accelerator activated (unknown): ${action}`);
          return;
        }

        appendLog(`accelerator activated: ${entry.key} (${action})`);
        if (entry.binding.release) {
          appendLog(`binding release not supported: ${entry.key}`);
        }

        this.executeCommand(entry.binding.command);
      }
    );
  }

  private registerMode(name: string): void {
    const mode = this.modes.get(name);
    if (!mode) {
      return;
    }

    const failures: string[] = [];
    for (const binding of mode.bindings) {
      for (const key of binding.keys) {
        const action = this.display.grab_accelerator(
          key,
          Meta.KeyBindingFlags.NONE
        );
        if (!action) {
          failures.push(key);
          appendLog(`failed to grab accelerator: ${key}`);
          continue;
        }

        const name = Meta.external_binding_name_for_action(action);
        Main.wm.allowKeybinding(name, Shell.ActionMode.ALL);
        appendLog(`grabbed accelerator: ${key} (${action})`);
        this.activeBindings.set(action, { binding, key, name });
      }
    }

    if (failures.length > 0) {
      const summary = failures.length > 6
        ? `${failures.slice(0, 6).join(", ")} (+${failures.length - 6} more)`
        : failures.join(", ");
      this.queueNotification(`Keybinding conflicts: ${summary}`);
    }
  }

  private unregisterAll(): void {
    for (const [action, entry] of this.activeBindings.entries()) {
      Main.wm.allowKeybinding(entry.name, Shell.ActionMode.NONE);
      this.display.ungrab_accelerator(action);
    }
    this.activeBindings.clear();
  }

  private queueNotification(message: string): void {
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      try {
        this.notify(message);
      } catch (error) {
        appendLog(`notification failed: ${error}`);
      }
      return GLib.SOURCE_REMOVE;
    });
  }
}
