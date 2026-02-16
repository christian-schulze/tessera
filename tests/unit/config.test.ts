import { applyConfig, DEFAULT_CONFIG } from "../../src/config.ts";

describe("config", () => {
  it("defaults minTileHeight to 240", () => {
    expect(DEFAULT_CONFIG.minTileHeight).toBe(240);
  });

  it("normalizes minTileHeight values", () => {
    const config = { ...DEFAULT_CONFIG };
    applyConfig(config, { minTileHeight: 251.9 });
    expect(config.minTileHeight).toBe(251);
  });
});
