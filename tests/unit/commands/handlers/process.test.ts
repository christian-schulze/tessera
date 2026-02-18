import type { Command } from "../../../../src/commands/types.ts";
import { WindowContainer } from "../../../../src/tree/window-container.ts";
import { execHandler, killHandler } from "../../../../src/commands/handlers/process.ts";

describe("Process command handlers", () => {
  const makeCommand = (action: string, args: string[] = []): Command => ({
    raw: [action, ...args].join(" "),
    action,
    args,
    criteria: [],
  });

  const makeAdapter = () => ({
    execCalls: [] as string[],
    closeCalls: [] as unknown[],
    activate: () => {},
    moveResize: () => {},
    setFullscreen: () => {},
    setFloating: () => {},
    close(window: unknown) {
      this.closeCalls.push(window);
    },
    exec(command: string) {
      this.execCalls.push(command);
    },
    changeWorkspace: () => {},
    moveToWorkspace: () => {},
  });

  it("exec runs a command string", () => {
    const adapter = makeAdapter();

    const result = execHandler.execute(makeCommand("exec", ["alacritty", "--"]), {
      root: {} as any,
      focused: null,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" },
      reloadConfig: () => {},
    });

    expect(result.success).toBeTrue();
    expect(adapter.execCalls).toEqual(["alacritty --"]);
  });

  it("kill closes focused windows", () => {
    const window = {};
    const focused = new WindowContainer(1, window, 1, "app", "title");
    const adapter = makeAdapter();

    const result = killHandler.execute(makeCommand("kill"), {
      root: {} as any,
      focused,
      adapter,
      config: { minTileWidth: 300, minTileHeight: 240, alternatingMode: "focused" },
      reloadConfig: () => {},
    });

    expect(result.success).toBeTrue();
    expect(adapter.closeCalls).toEqual([window]);
  });
});
