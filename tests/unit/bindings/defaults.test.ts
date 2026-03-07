import { buildDefaultBindingModes } from "../../../src/bindings/defaults.ts";

describe("default bindings", () => {
  it("includes a floating toggle binding in default mode", () => {
    const modes = buildDefaultBindingModes();
    const defaultMode = modes.find((mode) => mode.name === "default");

    expect(defaultMode).toBeDefined();
    expect(defaultMode?.bindings).toContain({
      keys: ["<Super><Shift>f"],
      command: "floating toggle",
    });
  });

  it("includes a binding-help toggle binding in default mode", () => {
    const modes = buildDefaultBindingModes();
    const defaultMode = modes.find((mode) => mode.name === "default");

    expect(defaultMode).toBeDefined();
    expect(defaultMode?.bindings).toContain({
      keys: ["<Super><Shift>slash"],
      command: "binding-help",
    });
  });
});
