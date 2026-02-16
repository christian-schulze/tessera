import { resolveSocketPath } from "../../../src/ipc/resolve.js";

describe("ipc cli", () => {
  it("picks the highest pid socket", () => {
    const socket = resolveSocketPath([
      "/run/user/1000/tessera.sock.9",
      "/run/user/1000/tessera.sock.10",
      "/run/user/1000/tessera.sock.3",
    ]);

    expect(socket).toBe("/run/user/1000/tessera.sock.10");
  });

  it("returns null when no sockets are available", () => {
    expect(resolveSocketPath([])).toBeNull();
  });
});
