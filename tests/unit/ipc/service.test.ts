import { buildTesseraService } from "../../../src/service/tessera.js";

describe("tessera service", () => {
  it("returns null tree when root missing", () => {
    const service = buildTesseraService({
      commandService: { execute: () => [] },
      getRoot: () => null,
      getConfig: () => ({ minTileWidth: 300, minTileHeight: 240 }),
      applyConfig: () => {},
      getVersion: () => ({ version: "1" }),
      getDebug: () => ({ ok: true }),
    });

    expect(service.tree()).toBeNull();
  });

  it("applies config and returns snapshot", () => {
    const config = { minTileWidth: 300, minTileHeight: 240 };
    let applied: { minTileWidth?: number; minTileHeight?: number } | null = null;
    const service = buildTesseraService({
      commandService: { execute: () => [] },
      getRoot: () => null,
      getConfig: () => config,
      applyConfig: (_config, params) => {
        applied = params ?? null;
      },
      getVersion: () => ({ version: "1" }),
      getDebug: () => ({ ok: true }),
    });

    const result = service.config({ minTileWidth: 360, minTileHeight: 200 });

    expect(applied).toEqual({ minTileWidth: 360, minTileHeight: 200 });
    expect(result).toEqual({ minTileWidth: 300, minTileHeight: 240 });
  });
});
