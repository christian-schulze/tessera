import type { CommandEngine } from "../../../src/commands/engine.js";
import type { WindowAdapter } from "../../../src/commands/adapter.js";
import { buildCommandService } from "../../../src/commands/service.js";

describe("command service", () => {
  it("returns an error when root is not ready", () => {
    const engine = {
      executeBatch: () => [{ success: true }],
    } as unknown as CommandEngine;

    const adapter = {
      activate: () => {},
      moveResize: () => {},
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
    } as WindowAdapter;

    const service = buildCommandService({
      engine,
      adapter,
      getRoot: () => null,
      getFocused: () => null,
    });

    expect(service.execute("focus left")).toEqual([
      { success: false, message: "Root container is not ready" },
    ]);
  });

  it("passes root, focused, and adapter to the engine", () => {
    const root = {};
    const adapter = {
      activate: () => {},
      moveResize: () => {},
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
    } as WindowAdapter;

    let captured: { root: unknown; focused: unknown; adapter: WindowAdapter } | null = null;
    const engine = {
      executeBatch: (
        _commands: unknown,
        context: { root: unknown; focused: unknown; adapter: WindowAdapter }
      ) => {
        captured = { root: context.root, focused: context.focused, adapter: context.adapter };
        return [{ success: true }];
      },
    } as unknown as CommandEngine;

    const service = buildCommandService({
      engine,
      adapter,
      getRoot: () => root as never,
      getFocused: () => null,
    });

    service.execute("focus left");

    expect(captured).toEqual({ root, focused: null, adapter });
  });
});
