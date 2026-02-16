# Unix Socket IPC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dev-only Unix domain socket IPC channel for controlling the extension without DBus.

**Architecture:** The extension starts a local Unix socket server when a debug flag is set, using a PID-suffixed socket path in `XDG_RUNTIME_DIR`. A lightweight JSON request/response protocol exposes `execute`, `tree`, and `ping` methods. A small CLI client discovers the active socket and sends commands.

**Tech Stack:** TypeScript (GJS), Gio/GLib, Node.js CLI, Jasmine tests.

---

### Task 1: Define IPC protocol and codec

**Files:**
- Create: `src/ipc/types.ts`
- Create: `src/ipc/codec.ts`
- Create: `tests/unit/ipc/codec.test.ts`

**Step 1: Write the failing test**

```ts
import { decodeRequest, encodeResponse } from "../../../src/ipc/codec.js";

describe("ipc codec", () => {
  it("decodes a valid execute request", () => {
    const request = decodeRequest('{"id":"1","method":"execute","params":{"command":"focus left"}}');
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
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `src/ipc/codec.js`.

**Step 3: Write minimal implementation**

```ts
// src/ipc/types.ts
export type IpcMethod = "execute" | "tree" | "ping" | "version";

export interface IpcRequest {
  id: string;
  method: IpcMethod;
  params?: Record<string, unknown>;
}

export interface IpcResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}
```

```ts
// src/ipc/codec.ts
import type { IpcRequest, IpcResponse } from "./types.js";

export function decodeRequest(payload: string): IpcRequest {
  const parsed = JSON.parse(payload) as IpcRequest;
  if (!parsed?.id || !parsed?.method) {
    throw new Error("Invalid IPC request");
  }
  return parsed;
}

export function encodeResponse(response: IpcResponse): string {
  return JSON.stringify(response);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for ipc codec tests.

**Step 5: Commit**

```bash
git add src/ipc/types.ts src/ipc/codec.ts tests/unit/ipc/codec.test.ts
git commit -m "feat: add ipc request/response codec"
```

### Task 2: Add Unix socket server in extension

**Files:**
- Create: `src/ipc/server.ts`
- Modify: `src/extension.ts`

**Step 1: Write the failing test**

```ts
import { buildSocketPath } from "../../../src/ipc/server.js";

describe("ipc server", () => {
  it("builds a pid-suffixed socket path", () => {
    const path = buildSocketPath("/run/user/1000", 1234);
    expect(path).toBe("/run/user/1000/tessera.sock.1234");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `src/ipc/server.js`.

**Step 3: Write minimal implementation**

```ts
// src/ipc/server.ts
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import type { IpcRequest, IpcResponse } from "./types.js";
import { decodeRequest, encodeResponse } from "./codec.js";

export function buildSocketPath(runtimeDir: string, pid: number): string {
  return `${runtimeDir}/tessera.sock.${pid}`;
}

export interface IpcHandlers {
  execute(command: string): unknown;
  tree(): unknown;
  ping(): unknown;
  version(): string;
}

export class IpcServer {
  private service: Gio.SocketService | null = null;
  private socketPath: string | null = null;

  start(handlers: IpcHandlers): string {
    const runtimeDir = GLib.getenv("XDG_RUNTIME_DIR") ?? "/tmp";
    const path = buildSocketPath(runtimeDir, GLib.getpid());
    this.socketPath = path;

    try {
      GLib.unlink(path);
    } catch (_) {
      // ignore if not present
    }

    const address = Gio.UnixSocketAddress.new(path);
    const service = new Gio.SocketService();
    service.add_address(address, Gio.SocketType.STREAM, Gio.SocketProtocol.DEFAULT, null);
    service.connect("incoming", (_service, connection) => {
      this.handleConnection(connection, handlers);
      return true;
    });
    service.start();
    this.service = service;
    return path;
  }

  stop(): void {
    if (this.service) {
      this.service.stop();
    }
    if (this.socketPath) {
      try {
        GLib.unlink(this.socketPath);
      } catch (_) {
        // ignore
      }
    }
    this.service = null;
    this.socketPath = null;
  }

  private handleConnection(connection: Gio.SocketConnection, handlers: IpcHandlers): void {
    const input = connection.get_input_stream();
    const output = connection.get_output_stream();
    const data = input.read_bytes(1024, null).toArray();
    const payload = new TextDecoder().decode(data).trim();
    let response: IpcResponse;

    try {
      const request = decodeRequest(payload) as IpcRequest;
      response = this.dispatch(request, handlers);
    } catch (error) {
      response = { id: "unknown", ok: false, error: String(error) };
    }

    output.write_all(encodeResponse(response), null);
    connection.close(null);
  }

  private dispatch(request: IpcRequest, handlers: IpcHandlers): IpcResponse {
    switch (request.method) {
      case "execute":
        return { id: request.id, ok: true, result: handlers.execute(String(request.params?.command ?? "")) };
      case "tree":
        return { id: request.id, ok: true, result: handlers.tree() };
      case "ping":
        return { id: request.id, ok: true, result: handlers.ping() };
      case "version":
        return { id: request.id, ok: true, result: handlers.version() };
      default:
        return { id: request.id, ok: false, error: `Unknown method: ${request.method}` };
    }
  }
}
```

In `src/extension.ts`:
- Start the server only when `GLib.getenv("TESSERA_IPC") === "1"`.
- Provide handlers that call the existing command engine and `root?.toJSON()`.
- Stop the server in `disable()`.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for ipc server path test.

**Step 5: Commit**

```bash
git add src/ipc/server.ts src/extension.ts tests/unit/ipc/server.test.ts
git commit -m "feat: add dev unix socket ipc server"
```

### Task 3: Add CLI client for IPC

**Files:**
- Create: `scripts/ipc-run.js`

**Step 1: Write the failing test**

```ts
import { resolveSocketPath } from "../../scripts/ipc-run.js";

describe("ipc cli", () => {
  it("prefers the newest socket", () => {
    const path = resolveSocketPath(["/run/user/1000/tessera.sock.1", "/run/user/1000/tessera.sock.2"]);
    expect(path).toBe("/run/user/1000/tessera.sock.2");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with module not found for `scripts/ipc-run.js`.

**Step 3: Write minimal implementation**

```js
#!/usr/bin/env node
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

export function resolveSocketPath(candidates) {
  return candidates.sort().at(-1) ?? "";
}

const runtimeDir = process.env.XDG_RUNTIME_DIR ?? "/tmp";
const candidates = fs.readdirSync(runtimeDir)
  .filter((entry) => entry.startsWith("tessera.sock."))
  .map((entry) => path.join(runtimeDir, entry));

const socketPath = resolveSocketPath(candidates);
if (!socketPath) {
  console.error("No tessera IPC socket found.");
  process.exit(1);
}

const [method, ...rest] = process.argv.slice(2);
const payload = JSON.stringify({
  id: String(Date.now()),
  method: method ?? "ping",
  params: method === "execute" ? { command: rest.join(" ") } : {},
});

const client = net.createConnection(socketPath, () => {
  client.write(payload);
});

client.on("data", (data) => {
  console.log(data.toString());
  client.end();
});
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for ipc cli resolve test.

**Step 5: Commit**

```bash
git add scripts/ipc-run.js tests/unit/ipc/cli.test.ts
git commit -m "feat: add ipc cli"
```

### Task 4: Remove DBus helper scripts and document usage

**Files:**
- Delete: `scripts/lg-run.sh`
- Delete: `scripts/lg-tree.js`
- Delete: `scripts/lg-exec.js`
- Modify: `README.md`

**Step 1: Update documentation**

Add a section explaining how to enable IPC and run:

```bash
TESSERA_IPC=1 make nested
node scripts/ipc-run.js tree
node scripts/ipc-run.js execute "splitv; focus right"
```

**Step 2: Commit**

```bash
git add README.md scripts/lg-run.sh scripts/lg-tree.js scripts/lg-exec.js
git commit -m "docs: replace dbus scripts with ipc client"
```

---

## Manual Verification (Required)

- Status: NOT RUN
- Date:
- Notes:
- Checklist:
  - Run `TESSERA_IPC=1 make nested`.
  - Run `node scripts/ipc-run.js tree` and verify JSON includes focused node.
  - Run `node scripts/ipc-run.js execute "splitv; focus right"` and confirm behavior.
