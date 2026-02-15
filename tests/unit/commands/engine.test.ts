import { CommandEngine } from "../../../src/commands/engine.ts";
import { RootContainer } from "../../../src/tree/root-container.ts";
import type { Command, CommandHandler, CommandResult } from "../../../src/commands/types.ts";

describe("Command engine", () => {
  it("executes a registered handler", () => {
    const engine = new CommandEngine();
    const root = new RootContainer("root");
    const focused = root;
    const adapter = {
      activate: () => {},
      moveResize: () => {},
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
    };
    const result: CommandResult = { success: true, message: "focused" };

    const handler: CommandHandler = {
      action: "focus",
      execute: (command: Command) => {
        expect(command.action).toBe("focus");
        return result;
      },
    };

    engine.register(handler);

    const command: Command = {
      raw: "focus",
      action: "focus",
      args: [],
      criteria: [],
    };

    const output = engine.execute(command, { root, focused, adapter });

    expect(output).toEqual(result);
  });

  it("returns an error for unknown commands", () => {
    const engine = new CommandEngine();
    const root = new RootContainer("root");
    const focused = root;
    const adapter = {
      activate: () => {},
      moveResize: () => {},
      setFullscreen: () => {},
      setFloating: () => {},
      close: () => {},
      exec: () => {},
    };

    const command: Command = {
      raw: "nope",
      action: "nope",
      args: [],
      criteria: [],
    };

    const output = engine.execute(command, { root, focused, adapter });

    expect(output.success).toBeFalse();
    expect(output.message).toBe("Unknown command: nope");
  });
});
