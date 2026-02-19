import type { BindingMode } from "./bindings/mode.js";
import { buildDefaultBindingModes } from "./bindings/defaults.js";

export type AlternatingMode = "focused" | "tail";

export type RuleCriteria = {
  app_id?: string;
  title?: string;
};

export type ForWindowRule = {
  match: RuleCriteria;
  commands: string[];
};

export type WorkspaceOutputMap = Record<string, number>;

export type TesseraConfig = {
  minTileWidth: number;
  minTileHeight: number;
  alternatingMode: AlternatingMode;
  modes: BindingMode[] | null;
  rules: ForWindowRule[];
  workspaceOutputs: WorkspaceOutputMap;
  exec: string[];
};

export const DEFAULT_CONFIG: TesseraConfig = {
  minTileWidth: 300,
  minTileHeight: 240,
  alternatingMode: "focused",
  modes: null,
  rules: [],
  workspaceOutputs: {},
  exec: [],
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

const normalizeAlternatingMode = (value: unknown): AlternatingMode | null => {
  if (value === "focused" || value === "tail") {
    return value;
  }

  return null;
};

const normalizeBinding = (value: unknown): BindingMode["bindings"][number] | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { keys?: unknown; command?: unknown; release?: unknown };
  if (!Array.isArray(candidate.keys) || candidate.keys.length === 0) {
    return null;
  }

  const keys = candidate.keys.filter((k): k is string => typeof k === "string");
  if (keys.length === 0) {
    return null;
  }

  if (typeof candidate.command !== "string" || !candidate.command.trim()) {
    return null;
  }

  const binding: BindingMode["bindings"][number] = {
    keys,
    command: candidate.command,
  };

  if (candidate.release === true) {
    binding.release = true;
  }

  return binding;
};

const normalizeModes = (value: unknown): BindingMode[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const modes: BindingMode[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as { name?: unknown; bindings?: unknown };
    if (typeof candidate.name !== "string" || !candidate.name.trim()) {
      continue;
    }

    if (!Array.isArray(candidate.bindings)) {
      continue;
    }

    const bindings: BindingMode["bindings"] = [];
    for (const raw of candidate.bindings) {
      const binding = normalizeBinding(raw);
      if (binding) {
        bindings.push(binding);
      }
    }

    modes.push({ name: candidate.name, bindings });
  }

  return modes.length > 0 ? modes : null;
};

const normalizeRules = (value: unknown): ForWindowRule[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const rules: ForWindowRule[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as { match?: unknown; commands?: unknown };
    if (!candidate.match || typeof candidate.match !== "object") {
      continue;
    }

    if (!Array.isArray(candidate.commands) || candidate.commands.length === 0) {
      continue;
    }

    const commands = candidate.commands.filter(
      (c): c is string => typeof c === "string" && c.trim().length > 0
    );
    if (commands.length === 0) {
      continue;
    }

    const match = candidate.match as { app_id?: unknown; title?: unknown };
    const criteria: RuleCriteria = {};
    if (typeof match.app_id === "string") {
      criteria.app_id = match.app_id;
    }
    if (typeof match.title === "string") {
      criteria.title = match.title;
    }

    if (!criteria.app_id && !criteria.title) {
      continue;
    }

    rules.push({ match: criteria, commands });
  }

  return rules.length > 0 ? rules : null;
};

const normalizeWorkspaceOutputs = (value: unknown): WorkspaceOutputMap | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return null;
  }

  const map: WorkspaceOutputMap = {};
  let hasValid = false;
  for (const [key, val] of entries) {
    if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
      map[key] = Math.floor(val);
      hasValid = true;
    }
  }

  return hasValid ? map : null;
};

const normalizeExec = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const commands = value.filter(
    (c): c is string => typeof c === "string" && c.trim().length > 0
  );

  return commands.length > 0 ? commands : null;
};

export const applyConfig = (
  target: TesseraConfig,
  updates: unknown
): TesseraConfig => {
  if (!updates || typeof updates !== "object") {
    return target;
  }

  const candidate = updates as Record<string, unknown>;

  const minTileWidth = normalizeMinTileWidth(candidate.minTileWidth);
  if (minTileWidth !== null) {
    target.minTileWidth = minTileWidth;
  }

  const minTileHeight = normalizeMinTileHeight(candidate.minTileHeight);
  if (minTileHeight !== null) {
    target.minTileHeight = minTileHeight;
  }

  const alternatingMode = normalizeAlternatingMode(candidate.alternatingMode);
  if (alternatingMode !== null) {
    target.alternatingMode = alternatingMode;
  }

  const modes = normalizeModes(candidate.modes);
  if (modes !== null) {
    target.modes = modes;
  }

  const rules = normalizeRules(candidate.rules);
  if (rules !== null) {
    target.rules = rules;
  }

  const workspaceOutputs = normalizeWorkspaceOutputs(candidate.workspaceOutputs);
  if (workspaceOutputs !== null) {
    target.workspaceOutputs = workspaceOutputs;
  }

  const exec = normalizeExec(candidate.exec);
  if (exec !== null) {
    target.exec = exec;
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

    const tessera = { defaults: { buildDefaultBindingModes } };
    const module = { exports: {} as Record<string, unknown> };
    const exports = module.exports;
    const factory = new Function(
      "module",
      "exports",
      "tessera",
      `${contents}\n;return module.exports ?? exports.config ?? exports.default ?? exports;`
    );
    const result = factory(module, exports, tessera);
    applyConfig(config, result);
  } catch (error) {
    console.warn(`Failed to load tessera config: ${error}`);
  }

  return config;
};
