const socketPrefix = "tessera.sock.";

const extractPid = (path: string): number | null => {
  const index = path.lastIndexOf(socketPrefix);
  if (index === -1) {
    return null;
  }

  const pid = Number(path.slice(index + socketPrefix.length));
  return Number.isFinite(pid) ? pid : null;
};

export const resolveSocketPath = (candidates: string[]): string | null => {
  let bestPath: string | null = null;
  let bestPid = -1;

  for (const candidate of candidates) {
    const pid = extractPid(candidate);
    if (pid === null) {
      continue;
    }

    if (pid > bestPid) {
      bestPid = pid;
      bestPath = candidate;
    }
  }

  return bestPath;
};
