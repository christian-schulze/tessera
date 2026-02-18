import { reloadBindings } from "../../../src/bindings/reload.ts";
import { DEFAULT_CONFIG, type TesseraConfig } from "../../../src/config.ts";
import type { BindingMode } from "../../../src/bindings/mode.ts";

const freshConfig = (): TesseraConfig => ({
  ...DEFAULT_CONFIG,
  gaps: { ...DEFAULT_CONFIG.gaps },
  focusedBorder: { ...DEFAULT_CONFIG.focusedBorder },
  rules: [],
  workspaceOutputs: {},
  exec: [],
});

describe("reloadBindings", () => {
  const createMockManager = () => {
    const calls: string[] = [];
    const modes: BindingMode[] = [];
    let activeMode: string | null = null;

    return {
      calls,
      modes,
      getActiveMode: () => activeMode,
      disable: () => {
        calls.push("disable");
      },
      clearModes: () => {
        calls.push("clearModes");
        modes.length = 0;
        activeMode = null;
      },
      addMode: (mode: BindingMode) => {
        calls.push(`addMode:${mode.name}`);
        modes.push(mode);
        if (!activeMode) {
          activeMode = mode.name;
        }
      },
      switchMode: (name: string) => {
        calls.push(`switchMode:${name}`);
        activeMode = name;
        return true;
      },
      enable: () => {
        calls.push("enable");
      },
    };
  };

  it("disables, clears, adds modes, switches, and enables", () => {
    const manager = createMockManager();
    manager.addMode({ name: "old", bindings: [] });
    manager.calls.length = 0;

    const config = freshConfig();
    config.modes = [
      { name: "default", bindings: [{ keys: ["<Super>h"], command: "focus left" }] },
    ];

    reloadBindings(manager as never, config);

    expect(manager.calls).toEqual([
      "disable",
      "clearModes",
      "addMode:default",
      "switchMode:default",
      "enable",
    ]);
    expect(manager.modes).toEqual(config.modes);
  });

  it("falls back to default binding modes when config.modes is null", () => {
    const manager = createMockManager();
    manager.addMode({ name: "old", bindings: [] });
    manager.calls.length = 0;

    const config = freshConfig();
    config.modes = null;

    reloadBindings(manager as never, config);

    expect(manager.calls[0]).toBe("disable");
    expect(manager.calls[1]).toBe("clearModes");
    expect(manager.calls[2]).toBe("addMode:default");
    expect(manager.calls[3]).toBe("addMode:resize");
    expect(manager.calls[4]).toBe("switchMode:default");
    expect(manager.calls[5]).toBe("enable");
  });

  it("does not re-enable when manager had no active mode", () => {
    const manager = createMockManager();

    const config = freshConfig();
    config.modes = [
      { name: "default", bindings: [] },
    ];

    reloadBindings(manager as never, config);

    expect(manager.calls).not.toContain("enable");
  });
});
