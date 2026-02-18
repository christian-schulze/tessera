import type { Command } from "../../../../src/commands/types.ts";
import { WindowContainer } from "../../../../src/tree/window-container.ts";
import { execHandler, execCaptureHandler, killHandler } from "../../../../src/commands/handlers/process.ts";
import { DEFAULT_CONFIG } from "../../../../src/config.ts";

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

  const config = { ...DEFAULT_CONFIG };

  it("exec runs a command string", () => {
    const adapter = makeAdapter();

    const result = execHandler.execute(makeCommand("exec", ["alacritty", "--"]), {
      root: {} as never,
      focused: null,
      adapter,
      config,
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
      root: {} as never,
      focused,
      adapter,
      config,
      reloadConfig: () => {},
    });

    expect(result.success).toBeTrue();
    expect(adapter.closeCalls).toEqual([window]);
  });

  describe("exec-capture", () => {
    it("fails when execCapture is unavailable", () => {
      const adapter = makeAdapter();
      const result = execCaptureHandler.execute(
        makeCommand("exec-capture", ["echo", "hello"]),
        {
          root: {} as never,
          focused: null,
          adapter,
          config,
        }
      );
      expect(result.success).toBeFalse();
      expect(result.message).toBe("Exec capture is unavailable");
    });

    it("fails when command is empty", () => {
      const adapter = makeAdapter();
      const result = execCaptureHandler.execute(
        makeCommand("exec-capture", []),
        {
          root: {} as never,
          focused: null,
          adapter,
          config,
        }
      );
      expect(result.success).toBeFalse();
      expect(result.message).toBe("Command required");
    });

    it("returns pending promise when execCapture is available", () => {
      const adapter = {
        ...makeAdapter(),
        execCapture: (_cmd: string) =>
          Promise.resolve({ stdout: "out", stderr: "", exitCode: 0 }),
      };
      const result = execCaptureHandler.execute(
        makeCommand("exec-capture", ["echo", "hello"]),
        {
          root: {} as never,
          focused: null,
          adapter,
          config,
        }
      );
      expect(result.success).toBeTrue();
      expect(result.data).toBeDefined();
    });
  });
});
