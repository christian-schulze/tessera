export const buildSocketPath = (runtimeDir: string, pid: number): string =>
  `${runtimeDir}/tessera.sock.${pid}`;
