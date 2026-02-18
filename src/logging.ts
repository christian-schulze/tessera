type NodeProcess = {
  env?: Record<string, string | undefined>;
};

const getGLib = (): typeof import("gi://GLib").default | null => {
  const glib = (globalThis as {
    imports?: { gi?: { GLib?: unknown } };
  }).imports?.gi?.GLib;
  return glib ? (glib as typeof import("gi://GLib").default) : null;
};

const getStateDir = (): string => {
  const GLib = getGLib();
  if (GLib) {
    return GLib.getenv("XDG_STATE_HOME") ??
      GLib.build_filenamev([GLib.get_home_dir(), ".local", "state"]);
  }
  const env = (globalThis as { process?: NodeProcess }).process?.env;
  const stateHome = env?.XDG_STATE_HOME;
  if (stateHome) {
    return stateHome;
  }
  const home = env?.HOME;
  return home ? `${home}/.local/state` : ".local/state";
};

export const getLogPath = (): string => {
  const GLib = getGLib();
  if (GLib) {
    return GLib.build_filenamev([getStateDir(), "tessera", "tessera.log"]);
  }
  return `${getStateDir()}/tessera/tessera.log`;
};

export const appendLog = (message: string): void => {
  const GLib = getGLib();
  if (!GLib) {
    return;
  }
  try {
    const path = getLogPath();
    const dir = GLib.path_get_dirname(path);
    GLib.mkdir_with_parents(dir, 0o755);
    const [ok, contents] = GLib.file_get_contents(path);
    const existing = ok ? contents.toString() : "";
    const entry = `[${new Date().toISOString()}] ${message}\n`;
    GLib.file_set_contents(path, existing + entry);
  } catch {
    // ignore logging failures
  }
};
