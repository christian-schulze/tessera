export type TesseraConfig = {
  minTileWidth: number;
  minTileHeight: number;
};

export const DEFAULT_CONFIG: TesseraConfig = {
  minTileWidth: 300,
  minTileHeight: 240,
};

const normalizeMinTileWidth = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return null;
  }

  return Math.floor(value);
};

const normalizeMinTileHeight = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return null;
  }

  return Math.floor(value);
};

export const applyConfig = (
  target: TesseraConfig,
  updates: unknown
): TesseraConfig => {
  if (!updates || typeof updates !== "object") {
    return target;
  }

  const candidate = updates as { minTileWidth?: unknown; minTileHeight?: unknown };
  const minTileWidth = normalizeMinTileWidth(candidate.minTileWidth);
  if (minTileWidth !== null) {
    target.minTileWidth = minTileWidth;
  }

  const minTileHeight = normalizeMinTileHeight(candidate.minTileHeight);
  if (minTileHeight !== null) {
    target.minTileHeight = minTileHeight;
  }

  return target;
};

export const loadConfig = (): TesseraConfig => {
  const GLib = (() => {
    const glib = (globalThis as {
      imports?: { gi?: { GLib?: unknown } };
    }).imports?.gi?.GLib;
    if (!glib) {
      throw new Error("GLib is unavailable");
    }
    return glib as typeof import("gi://GLib").default;
  })();
  const config: TesseraConfig = { ...DEFAULT_CONFIG };
  const home = GLib.get_home_dir();
  const path = GLib.build_filenamev([home, ".config", "tessera", "config.js"]);

  if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
    return config;
  }

  try {
    const contents = GLib.file_get_contents(path)[1]?.toString() ?? "";
    if (!contents.trim()) {
      return config;
    }

    const module = { exports: {} as Record<string, unknown> };
    const exports = module.exports;
    const factory = new Function(
      "module",
      "exports",
      `${contents}\n;return module.exports ?? exports.config ?? exports.default ?? exports;`
    );
    const result = factory(module, exports);
    applyConfig(config, result);
  } catch (error) {
    console.warn(`Failed to load tessera config: ${error}`);
  }

  return config;
};
