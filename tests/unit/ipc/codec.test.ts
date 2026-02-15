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
});
