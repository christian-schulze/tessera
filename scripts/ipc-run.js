import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { resolveSocketPath } from "../src/ipc/resolve.js";

const runtimeDir = process.env.XDG_RUNTIME_DIR ?? "/tmp";
const socketPrefix = "tessera.sock.";

const readSockets = async () => {
  const entries = await fs.readdir(runtimeDir);
  return entries
    .filter((entry) => entry.startsWith(socketPrefix))
    .map((entry) => path.join(runtimeDir, entry));
};

const usage = () => {
  console.error("Usage: node scripts/ipc-run.js <method> [command]");
  console.error("Methods: tree, ping, version, execute");
};

const method = process.argv[2];
if (!method) {
  usage();
  process.exit(1);
}

const params =
  method === "execute"
    ? { command: process.argv.slice(3).join(" ") }
    : undefined;

if (method === "execute" && !params?.command) {
  usage();
  process.exit(1);
}

const request = {
  id: `${Date.now()}`,
  method,
  params,
};

const run = async () => {
  const candidates = await readSockets();
  const socketPath = resolveSocketPath(candidates);

  if (!socketPath) {
    console.error("No Tessera IPC socket found.");
    process.exit(1);
  }

  const socket = net.createConnection({ path: socketPath });
  let response = "";

  socket.on("data", (chunk) => {
    response += chunk.toString();
  });

  socket.on("end", () => {
    console.log(response);
  });

  socket.on("error", (error) => {
    console.error(`IPC error: ${error.message}`);
    process.exit(1);
  });

  socket.write(JSON.stringify(request));
  socket.end();
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
