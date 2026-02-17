import GLib from "gi://GLib";

const getStateDir = (): string => {
  return GLib.getenv("XDG_STATE_HOME") ?? GLib.build_filenamev([
    GLib.get_home_dir(),
    ".local",
    "state",
  ]);
};

export const getLogPath = (): string => {
  return GLib.build_filenamev([getStateDir(), "tessera", "tessera.log"]);
};

export const appendLog = (message: string): void => {
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
