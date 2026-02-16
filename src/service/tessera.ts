import type { RootContainer } from "../tree/root-container.js";
import type { CommandService } from "../commands/service.js";
import type { ConfigParams, ConfigResponse } from "../ipc/types.js";
import type { TesseraConfig } from "../config.js";

export type TesseraService = {
  execute: (command: string) => unknown;
  tree: () => unknown;
  ping: () => unknown;
  version: () => unknown;
  debug: () => unknown;
  config: (params?: ConfigParams) => ConfigResponse;
};

type TesseraServiceDeps = {
  commandService: CommandService;
  getRoot: () => RootContainer | null;
  getConfig: () => TesseraConfig;
  applyConfig: (config: TesseraConfig, params?: ConfigParams) => void;
  getVersion: () => unknown;
  getDebug: () => unknown;
  getPing?: () => unknown;
};

export const buildTesseraService = (deps: TesseraServiceDeps): TesseraService => {
  return {
    execute: deps.commandService.execute,
    tree: () => deps.getRoot()?.toJSON() ?? null,
    ping: () => deps.getPing?.() ?? { ok: true },
    version: () => deps.getVersion(),
    debug: () => deps.getDebug(),
    config: (params) => {
      if (params) {
        deps.applyConfig(deps.getConfig(), params);
      }
      return { ...deps.getConfig() };
    },
  };
};
