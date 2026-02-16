import { decodeRequest, encodeResponse } from "../../../src/ipc/codec.js";

describe("ipc codec", () => {
  it("decodes a valid execute request", () => {
    const request = decodeRequest(
      '{"id":"1","method":"execute","params":{"command":"focus left"}}'
    );
    expect(request).toEqual({
      id: "1",
      method: "execute",
      params: { command: "focus left" },
    });
  });

  it("encodes a success response", () => {
    const json = encodeResponse({ id: "1", ok: true, result: { ok: true } });
    expect(json).toBe('{"id":"1","ok":true,"result":{"ok":true}}');
  });

  it("decodes a debug request", () => {
    const request = decodeRequest('{"id":"2","method":"debug"}');
    expect(request).toEqual({
      id: "2",
      method: "debug",
      params: undefined,
    });
  });

  it("decodes a config request", () => {
    const request = decodeRequest(
      '{"id":"3","method":"config","params":{"minTileWidth":360}}'
    );
    expect(request).toEqual({
      id: "3",
      method: "config",
      params: { minTileWidth: 360 },
    });
  });
});
