import { evaluateRules } from "../../src/rules.ts";
import { WindowContainer } from "../../src/tree/window-container.ts";
import type { ForWindowRule } from "../../src/config.ts";

const makeWindow = (appId: string, title: string, window_type = 0): WindowContainer => {
  const container = new WindowContainer(1, {}, 100, appId, title, window_type);
  return container;
};

describe("evaluateRules", () => {
  it("matches by app_id", () => {
    const rules: ForWindowRule[] = [
      { match: { app_id: "firefox" }, commands: ["move container to workspace 2"] },
    ];
    const container = makeWindow("firefox", "Mozilla Firefox");
    const commands = evaluateRules(rules, container);
    expect(commands).toEqual(["move container to workspace 2"]);
  });

  it("matches by title", () => {
    const rules: ForWindowRule[] = [
      { match: { title: "Picture-in-Picture" }, commands: ["floating enable"] },
    ];
    const container = makeWindow("firefox", "Picture-in-Picture");
    const commands = evaluateRules(rules, container);
    expect(commands).toEqual(["floating enable"]);
  });

  it("requires all criteria to match", () => {
    const rules: ForWindowRule[] = [
      { match: { app_id: "firefox", title: "PiP" }, commands: ["floating enable"] },
    ];
    const container = makeWindow("firefox", "Not PiP");
    const commands = evaluateRules(rules, container);
    expect(commands).toEqual([]);
  });

  it("matches when both app_id and title match", () => {
    const rules: ForWindowRule[] = [
      { match: { app_id: "firefox", title: "PiP" }, commands: ["floating enable"] },
    ];
    const container = makeWindow("firefox", "PiP");
    const commands = evaluateRules(rules, container);
    expect(commands).toEqual(["floating enable"]);
  });

  it("returns empty array when no rules match", () => {
    const rules: ForWindowRule[] = [
      { match: { app_id: "chrome" }, commands: ["floating enable"] },
    ];
    const container = makeWindow("firefox", "Mozilla Firefox");
    const commands = evaluateRules(rules, container);
    expect(commands).toEqual([]);
  });

  it("collects commands from multiple matching rules", () => {
    const rules: ForWindowRule[] = [
      { match: { app_id: "firefox" }, commands: ["move container to workspace 2"] },
      { match: { app_id: "firefox" }, commands: ["floating enable"] },
    ];
    const container = makeWindow("firefox", "Mozilla Firefox");
    const commands = evaluateRules(rules, container);
    expect(commands).toEqual(["move container to workspace 2", "floating enable"]);
  });

  it("matches by window_type", () => {
    const rules: ForWindowRule[] = [
      { match: { app_id: "firefox", window_type: "0" }, commands: ["floating enable"] },
    ];
    const normal = makeWindow("firefox", "Mozilla Firefox", 0);
    const dialog = makeWindow("firefox", "Open File", 3);

    expect(evaluateRules(rules, normal)).toEqual(["floating enable"]);
    expect(evaluateRules(rules, dialog)).toEqual([]);
  });

  it("returns empty array when rules list is empty", () => {
    const container = makeWindow("firefox", "Mozilla Firefox");
    const commands = evaluateRules([], container);
    expect(commands).toEqual([]);
  });

  it("supports multiple commands per rule", () => {
    const rules: ForWindowRule[] = [
      {
        match: { app_id: "nautilus" },
        commands: ["floating enable", "resize set 800 600"],
      },
    ];
    const container = makeWindow("nautilus", "Files");
    const commands = evaluateRules(rules, container);
    expect(commands).toEqual(["floating enable", "resize set 800 600"]);
  });
});
