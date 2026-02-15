import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { resolveSocketPath } from "../src/ipc/resolve.js";

const runtimeDirs = [
  process.env.XDG_RUNTIME_DIR,
  `/run/user/${process.getuid?.() ?? ""}`,
  "/tmp",
]
  .filter((entry): entry is string => Boolean(entry))
  .filter((entry, index, list) => list.indexOf(entry) === index);
const socketPrefix = "tessera.sock.";

const readSockets = async () => {
  const sockets: string[] = [];
  for (const runtimeDir of runtimeDirs) {
    try {
      const entries = await fs.readdir(runtimeDir);
      sockets.push(
        ...entries
          .filter((entry) => entry.startsWith(socketPrefix))
          .map((entry) => path.join(runtimeDir, entry))
      );
    } catch {
      // ignore missing dirs
    }
  }
  return sockets;
};

const usage = () => {
  console.error("Usage: bunx tsx scripts/ipc-run.ts <method> [command]");
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
    console.error(
      `No Tessera IPC socket found. Checked: ${runtimeDirs.join(", ")}`
    );
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
