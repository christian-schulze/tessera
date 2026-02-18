import { buildCommandEngine, registerDefaultHandlers } from "../../../src/commands/index.ts";
import { parseCommandString } from "../../../src/commands/parser.ts";
import { SplitContainer } from "../../../src/tree/split-container.ts";
import { WindowContainer } from "../../../src/tree/window-container.ts";
import { Layout } from "../../../src/tree/container.ts";

describe("Command execution end-to-end", () => {
  it("parses and executes a command batch", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    const parent = new SplitContainer(2, Layout.SplitH);
    parent.addChild(focused);

    const adapter = {
      activated: [] as unknown[],
      activate(target: unknown) {
        this.activated.push(target);
      },
      moveResize: () => {},
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
      changeWorkspace: () => {},
      moveToWorkspace: () => {},
    };

    const engine = buildCommandEngine();
    registerDefaultHandlers(engine);

    const commands = parseCommandString("focus; splitv; layout tabbed");
    const results = engine.executeBatch(commands, {
      root: parent as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" },
      reloadConfig: () => {},
      switchMode: () => true,
    });

    expect(results.every((result) => result.success)).toBeTrue();
    expect(adapter.activated).toEqual([window]);
    expect(parent.layout).toBe(Layout.Tabbed);
  });
});
