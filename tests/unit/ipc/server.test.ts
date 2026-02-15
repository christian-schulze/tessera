import { buildSocketPath } from "../../../src/ipc/paths.js";

describe("ipc server", () => {
  it("buildSocketPath uses runtime dir and pid", () => {
    expect(buildSocketPath("/run/user/1000", 1234)).toBe(
      "/run/user/1000/tessera.sock.1234"
    );
  });
});
