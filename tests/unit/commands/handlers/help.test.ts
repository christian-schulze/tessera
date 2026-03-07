import { bindingHelpHandler } from "../../../../src/commands/handlers/help.ts";

describe("bindingHelpHandler", () => {
  it("invokes toggleBindingHelp callback when available", () => {
    const toggleBindingHelp = jasmine.createSpy("toggleBindingHelp");

    const result = bindingHelpHandler.execute(
      {
        raw: "binding-help",
        action: "binding-help",
        args: [],
        criteria: [],
      },
      {
        root: {} as never,
        focused: null,
        adapter: {
          activate: () => {},
          moveResize: () => {},
          setFullscreen: () => {},
          setFloating: () => {},
          close: () => {},
          exec: () => {},
          changeWorkspace: () => {},
          moveToWorkspace: () => {},
        },
        config: {
          minTileWidth: 300,
          minTileHeight: 240,
          alternatingMode: "focused",
        },
        toggleBindingHelp,
      }
    );

    expect(result.success).toBeTrue();
    expect(toggleBindingHelp).toHaveBeenCalledTimes(1);
  });
});
