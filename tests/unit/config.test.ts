import { applyConfig, DEFAULT_CONFIG, type TesseraConfig } from "../../src/config.ts";

const freshConfig = (): TesseraConfig => ({
  ...DEFAULT_CONFIG,
  gaps: { ...DEFAULT_CONFIG.gaps },
  focusedBorder: { ...DEFAULT_CONFIG.focusedBorder },
  rules: [],
  workspaceOutputs: {},
  exec: [],
});

describe("config", () => {
  it("defaults minTileHeight to 240", () => {
    expect(DEFAULT_CONFIG.minTileHeight).toBe(240);
  });

  it("normalizes minTileHeight values", () => {
    const config = freshConfig();
    applyConfig(config, { minTileHeight: 251.9 });
    expect(config.minTileHeight).toBe(251);
  });

  it("has correct defaults for new fields", () => {
    expect(DEFAULT_CONFIG.focusedBorder).toEqual({ color: "", width: 0 });
    expect(DEFAULT_CONFIG.modes).toBeNull();
    expect(DEFAULT_CONFIG.rules).toEqual([]);
    expect(DEFAULT_CONFIG.workspaceOutputs).toEqual({});
    expect(DEFAULT_CONFIG.exec).toEqual([]);
  });

  xit("has correct default for gaps (not yet implemented)", () => {
    expect(DEFAULT_CONFIG.gaps).toEqual({ inner: 0, outer: 0 });
  });

  xdescribe("gaps", () => {
    it("applies valid gaps", () => {
      const config = freshConfig();
      applyConfig(config, { gaps: { inner: 8, outer: 4 } });
      expect(config.gaps).toEqual({ inner: 8, outer: 4 });
    });

    it("floors fractional gap values", () => {
      const config = freshConfig();
      applyConfig(config, { gaps: { inner: 8.7, outer: 4.3 } });
      expect(config.gaps).toEqual({ inner: 8, outer: 4 });
    });

    it("rejects negative gap values", () => {
      const config = freshConfig();
      applyConfig(config, { gaps: { inner: -1, outer: 4 } });
      expect(config.gaps).toEqual({ inner: 0, outer: 4 });
    });

    it("ignores non-object gaps", () => {
      const config = freshConfig();
      applyConfig(config, { gaps: "invalid" });
      expect(config.gaps).toEqual({ inner: 0, outer: 0 });
    });

    it("applies partial gaps with defaults", () => {
      const config = freshConfig();
      applyConfig(config, { gaps: { inner: 10 } });
      expect(config.gaps).toEqual({ inner: 10, outer: 0 });
    });
  });

  describe("focusedBorder", () => {
    it("applies valid focused border", () => {
      const config = freshConfig();
      applyConfig(config, { focusedBorder: { color: "#5294e2", width: 2 } });
      expect(config.focusedBorder).toEqual({ color: "#5294e2", width: 2 });
    });

    it("ignores non-object border", () => {
      const config = freshConfig();
      applyConfig(config, { focusedBorder: 42 });
      expect(config.focusedBorder).toEqual({ color: "", width: 0 });
    });

    it("applies partial border with defaults", () => {
      const config = freshConfig();
      applyConfig(config, { focusedBorder: { color: "#ff0000" } });
      expect(config.focusedBorder).toEqual({ color: "#ff0000", width: 0 });
    });
  });

  describe("modes", () => {
    it("applies valid modes", () => {
      const config = freshConfig();
      applyConfig(config, {
        modes: [
          {
            name: "default",
            bindings: [
              { keys: ["<Super>h"], command: "focus left" },
            ],
          },
        ],
      });
      expect(config.modes).toEqual([
        {
          name: "default",
          bindings: [{ keys: ["<Super>h"], command: "focus left" }],
        },
      ]);
    });

    it("strips invalid bindings from modes", () => {
      const config = freshConfig();
      applyConfig(config, {
        modes: [
          {
            name: "default",
            bindings: [
              { keys: ["<Super>h"], command: "focus left" },
              { keys: [], command: "bad" },
              { keys: ["<Super>j"], command: "" },
              "not-a-binding",
            ],
          },
        ],
      });
      expect(config.modes).toEqual([
        {
          name: "default",
          bindings: [{ keys: ["<Super>h"], command: "focus left" }],
        },
      ]);
    });

    it("rejects modes with no name", () => {
      const config = freshConfig();
      applyConfig(config, {
        modes: [{ name: "", bindings: [{ keys: ["a"], command: "focus left" }] }],
      });
      expect(config.modes).toBeNull();
    });

    it("ignores non-array modes", () => {
      const config = freshConfig();
      applyConfig(config, { modes: "invalid" });
      expect(config.modes).toBeNull();
    });

    it("preserves release flag on bindings", () => {
      const config = freshConfig();
      applyConfig(config, {
        modes: [
          {
            name: "default",
            bindings: [{ keys: ["<Super>h"], command: "focus left", release: true }],
          },
        ],
      });
      expect(config.modes![0].bindings[0].release).toBe(true);
    });
  });

  describe("rules", () => {
    it("applies valid rules", () => {
      const config = freshConfig();
      applyConfig(config, {
        rules: [
          { match: { app_id: "firefox" }, commands: ["move container to workspace 2"] },
        ],
      });
      expect(config.rules).toEqual([
        { match: { app_id: "firefox" }, commands: ["move container to workspace 2"] },
      ]);
    });

    it("rejects rules with no match criteria", () => {
      const config = freshConfig();
      applyConfig(config, {
        rules: [{ match: {}, commands: ["floating enable"] }],
      });
      expect(config.rules).toEqual([]);
    });

    it("rejects rules with empty commands", () => {
      const config = freshConfig();
      applyConfig(config, {
        rules: [{ match: { app_id: "firefox" }, commands: [] }],
      });
      expect(config.rules).toEqual([]);
    });

    it("accepts rules matching by title", () => {
      const config = freshConfig();
      applyConfig(config, {
        rules: [
          { match: { title: "Picture-in-Picture" }, commands: ["floating enable"] },
        ],
      });
      expect(config.rules).toEqual([
        { match: { title: "Picture-in-Picture" }, commands: ["floating enable"] },
      ]);
    });

    it("accepts rules with both app_id and title", () => {
      const config = freshConfig();
      applyConfig(config, {
        rules: [
          { match: { app_id: "firefox", title: "PiP" }, commands: ["floating enable"] },
        ],
      });
      expect(config.rules[0].match.app_id).toBe("firefox");
      expect(config.rules[0].match.title).toBe("PiP");
    });
  });

  describe("workspaceOutputs", () => {
    it("applies valid workspace-output map", () => {
      const config = freshConfig();
      applyConfig(config, { workspaceOutputs: { "1": 0, "2": 0, "3": 1 } });
      expect(config.workspaceOutputs).toEqual({ "1": 0, "2": 0, "3": 1 });
    });

    it("ignores non-object values", () => {
      const config = freshConfig();
      applyConfig(config, { workspaceOutputs: "bad" });
      expect(config.workspaceOutputs).toEqual({});
    });

    it("ignores entries with non-numeric values", () => {
      const config = freshConfig();
      applyConfig(config, { workspaceOutputs: { "1": "bad", "2": 1 } });
      expect(config.workspaceOutputs).toEqual({ "2": 1 });
    });

    it("rejects negative output indices", () => {
      const config = freshConfig();
      applyConfig(config, { workspaceOutputs: { "1": -1 } });
      expect(config.workspaceOutputs).toEqual({});
    });
  });

  describe("exec", () => {
    it("applies valid exec commands", () => {
      const config = freshConfig();
      applyConfig(config, { exec: ["alacritty", "firefox"] });
      expect(config.exec).toEqual(["alacritty", "firefox"]);
    });

    it("filters out non-string values", () => {
      const config = freshConfig();
      applyConfig(config, { exec: ["alacritty", 42, "", "firefox"] });
      expect(config.exec).toEqual(["alacritty", "firefox"]);
    });

    it("ignores non-array values", () => {
      const config = freshConfig();
      applyConfig(config, { exec: "alacritty" });
      expect(config.exec).toEqual([]);
    });
  });

  describe("backward compatibility", () => {
    xit("applies only existing fields without touching new defaults (gaps not yet implemented)", () => {
      const config = freshConfig();
      applyConfig(config, { minTileWidth: 400 });
      expect(config.minTileWidth).toBe(400);
      expect(config.gaps).toEqual({ inner: 0, outer: 0 });
      expect(config.modes).toBeNull();
      expect(config.rules).toEqual([]);
      expect(config.exec).toEqual([]);
    });

    it("handles null/undefined updates gracefully", () => {
      const config = freshConfig();
      applyConfig(config, null);
      expect(config).toEqual(freshConfig());
      applyConfig(config, undefined);
      expect(config).toEqual(freshConfig());
    });
  });
});
