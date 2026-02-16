import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { decodeRequest, encodeResponse } from "./codec.js";
import { buildSocketPath } from "./paths.js";
import type { IpcRequest, IpcResponse } from "./types.js";

type IpcHandlers = {
  execute: (command: string) => unknown;
  tree: () => unknown;
  ping: () => unknown;
  version: () => unknown;
  debug: () => unknown;
};

const readAll = (stream: Gio.InputStream): string => {
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const bytes = stream.read_bytes(4096, null);
    const size = bytes?.get_size() ?? 0;
    if (size === 0) {
      break;
    }

    const chunk = bytes.toArray();
    chunks.push(chunk);
    total += chunk.length;

    if (size < 4096) {
      break;
    }
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(buffer);
};

const getPid = (): number => {
  const glib = GLib as unknown as {
    getpid?: () => number;
    get_pid?: () => number;
  };

  return glib.getpid?.() ?? glib.get_pid?.() ?? 0;
};

export class IpcServer {
  private service: Gio.SocketService | null = null;
  private socketPath: string | null = null;
  private handlers: IpcHandlers | null = null;

  getSocketPath(): string | null {
    return this.socketPath;
  }

  start(handlers: IpcHandlers): void {
    if (this.service) {
      return;
    }

    const runtimeDir = GLib.getenv("XDG_RUNTIME_DIR") ?? "/tmp";
    const pid = getPid();
    const socketPath = buildSocketPath(runtimeDir, pid);

    console.log(
      `[tessera ipc] starting server pid=${pid} runtimeDir=${runtimeDir} socket=${socketPath}`
    );

    try {
      GLib.unlink(socketPath);
    } catch {
      // ignore
    }

    const address = Gio.UnixSocketAddress.new(socketPath);
    const service = new Gio.SocketService();
    service.add_address(
      address,
      Gio.SocketType.STREAM,
      Gio.SocketProtocol.DEFAULT,
      null
    );
    service.connect("incoming", (_service, connection) => {
      console.log("[tessera ipc] incoming connection");
      this.handleConnection(connection);
      return true;
    });
    service.start();

    this.handlers = handlers;
    this.socketPath = socketPath;
    this.service = service;
  }

  stop(): void {
    if (this.service) {
      this.service.stop();
    }

    if (this.socketPath) {
      console.log(`[tessera ipc] stopping server socket=${this.socketPath}`);
    }

    this.service = null;
    this.handlers = null;

    if (this.socketPath) {
      try {
        GLib.unlink(this.socketPath);
      } catch {
        // ignore
      }
    }
    this.socketPath = null;
  }

  private handleConnection(connection: Gio.SocketConnection): void {
    const input = connection.get_input_stream();
    const output = connection.get_output_stream();

    let response: IpcResponse;

    try {
      const payload = readAll(input);
      const request = decodeRequest(payload);
      response = this.handleRequest(request);
    } catch (error) {
      response = {
        id: "unknown",
        ok: false,
        error: error instanceof Error ? error.message : "Invalid request",
      };
    }

    const encoded = new TextEncoder().encode(encodeResponse(response));
    output.write_all(encoded, null);
    output.flush(null);
    connection.close(null);
  }

  private handleRequest(request: IpcRequest): IpcResponse {
    if (!this.handlers) {
      return {
        id: request.id,
        ok: false,
        error: "IPC handlers are not ready",
      };
    }

    try {
      switch (request.method) {
        case "execute": {
          const params = request.params as { command?: unknown } | undefined;
          const command = params?.command;
          if (typeof command !== "string") {
            throw new Error("Invalid execute params");
          }
          return {
            id: request.id,
            ok: true,
            result: this.handlers.execute(command),
          };
        }
        case "tree":
          return {
            id: request.id,
            ok: true,
            result: this.handlers.tree(),
          };
        case "ping":
          return {
            id: request.id,
            ok: true,
            result: this.handlers.ping(),
          };
        case "version":
          return {
            id: request.id,
            ok: true,
            result: this.handlers.version(),
          };
        case "debug":
          return {
            id: request.id,
            ok: true,
            result: this.handlers.debug(),
          };
        default:
          return {
            id: request.id,
            ok: false,
            error: "Unknown IPC method",
          };
      }
    } catch (error) {
      return {
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : "IPC request failed",
      };
    }
  }
}
